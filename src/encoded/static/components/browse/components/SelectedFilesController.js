'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { object, console, analytics, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { expFxn } from './../../util';


// Memoized helper functions for getting counts of files performantly-er.
// These are used often by other components which consume/display selected file counts.

/** Used and memoized in views which have multiple sets of selectedFiles */
export function uniqueFileCount(selectedFiles){
    if (!selectedFiles || typeof selectedFiles !== 'object' || Array.isArray(selectedFiles)){
        logger.error("selectedFiles not in proper form or is non-existent", selectedFiles);
        return 0;
    }
    return _.uniq(_.pluck(_.values(selectedFiles), 'accession')).length;
}

export function fileCountWithDuplicates(selectedFiles){
    return _.keys(selectedFiles).length;
}


/**
 * IN PROGRESS -- TODO: Decide if we should store "selectedFiles" or "unselectedFiles" (re: 'All files in facet selection are selected by default')
 *
 * @export
 * @class SelectedFilesController
 * @extends {React.Component}
 */
export class SelectedFilesController extends React.PureComponent {

    /** Utility function to extract out the relevant props passed in by `SelectedFilesController` out of a props object. */
    static pick(props){ return _.pick(props, 'selectedFiles', 'selectFile', 'unselectFile', 'resetSelectedFiles', 'incrementalExpandLimit', 'incrementalExpandStep'); }

    static listToObject(selectedFilesList){
        return _.object(_.map(
            // Ensure all files have an `@id` / view permissions.
            // Lack of view permissions is OK for when file visible in table as lack of permission
            // is shown (without checkbox).
            _.filter(selectedFilesList, object.itemUtil.atId),
            function(fileItem){
                return [ expFxn.fileToAccessionTriple(fileItem, true, true), fileItem ];
            }
        ));
    }

    static parseInitiallySelectedFiles(initiallySelectedFiles){

        if (initiallySelectedFiles === null){
            return {};
        }

        if (!Array.isArray(initiallySelectedFiles) && initiallySelectedFiles && typeof initiallySelectedFiles === 'object'){
            // Assume we got a well-formatted selectedFiles object. This is probably only case for tests, e.g. RawFilesStackedTable-test.js.
            // This means keys must be in form of stringified accession triples, e.g. `"EXPSETACCESSION~EXPACCESSION~FILEACCESSION"`
            // Lets validate that --
            _.forEach(_.keys(initiallySelectedFiles), function(key){
                const parts = key.split('~');
                if (parts.length !== 3){
                    logger.error('If supply an object as initiallySelectedFiles, it must have stringified accession triples as keys.');
                    throw new Error('If supply an object as initiallySelectedFiles, it must have stringified accession triples as keys.');
                }
            });
            return _.clone(initiallySelectedFiles);
        }

        if (Array.isArray(initiallySelectedFiles)){
            return SelectedFilesController.listToObject(initiallySelectedFiles);
        }
        logger.error(initiallySelectedFiles);
        throw new Error('Received unexpected props.initiallySelectedFiles -');
    }

    static defaultProps = {
        'initiallySelectedFiles' : null,
        'resetSelectedFilesCheck' : function(nextProps, pastProps){
            if (typeof nextProps.href === 'string') {
                if (nextProps.href !== pastProps.href) return true;
            }
            if (nextProps.context && pastProps.context && nextProps.context !== pastProps.context) {
                if (Array.isArray(pastProps.context['@graph']) && !Array.isArray(nextProps.context['@graph'])) return true;
                //if (Array.isArray(pastProps.context['@graph']) && Array.isArray(nextProps.context['@graph'])) {
                //    var pastGraph = pastProps.context['@graph'];
                //    var newGraph = nextProps.context['@graph'];
                //}
            }
            return false;
        },
        'analyticsAddFilesToCart' : false
    };

    constructor(props){
        super(props);
        this.selectFile = this.selectFile.bind(this);
        this.unselectFile = this.unselectFile.bind(this);
        this.resetSelectedFiles = this.resetSelectedFiles.bind(this);

        const selectedFiles = SelectedFilesController.parseInitiallySelectedFiles(props.initiallySelectedFiles);

        this.state = { selectedFiles };
    }

    componentDidMount(){
        const { analyticsAddFilesToCart = false } = this.props;
        if (!analyticsAddFilesToCart) {
            return;
        }
        const { selectedFiles, context } = this.state;
        const existingFileList = _.keys(selectedFiles).map(function(accessionTripleString){
            return selectedFiles[accessionTripleString];
        });
        if (existingFileList.length > 0) {
            setTimeout(function(){
                const extData = { list: analytics.hrefToListName(window && window.location.href) };
                analytics.productsAddToCart(existingFileList, extData);
                analytics.event(
                    "SelectedFilesController",
                    "Select Files",
                    {
                        eventLabel: extData.list,
                        eventValue: existingFileList.length,
                        currentFilters: analytics.getStringifiedCurrentFilters((context && context.filters) || null)
                    }
                );
            }, 250);
        }
    }

    componentDidUpdate(pastProps){
        if (this.props.resetSelectedFilesCheck(this.props, pastProps)){
            this.resetSelectedFiles();
        }
    }

    selectFile(accessionTriple, fileItem = null){
        const { context, analyticsAddFilesToCart = false } = this.props;
        function error(){
            logger.error("Supplied accessionTriple is not a string or array of strings/arrays:", accessionTriple);
            throw new Error("Supplied accessionTriple is not a string or array of strings/arrays:", accessionTriple);
        }
        const newlyAddedFileItems = [];
        this.setState(({ selectedFiles })=>{
            var newSelectedFiles = _.extend({}, selectedFiles);

            function add(id, fileItemCurr = null){
                if (typeof newSelectedFiles[id] !== 'undefined'){
                    logger.error("File already selected!", id);
                } else {
                    newSelectedFiles[id] = fileItemCurr || true;
                    if (fileItemCurr){
                        newlyAddedFileItems.push(fileItemCurr);
                    }
                }
            }

            if (Array.isArray(accessionTriple)){
                _.forEach(accessionTriple, function(id){
                    if (typeof id === 'string'){
                        add(id);
                    } else if (Array.isArray(id)){
                        add(id[0], id[1]);
                    } else error();
                });
            } else if (typeof accessionTriple === 'string') {
                add(accessionTriple, fileItem);
            } else error();

            return { 'selectedFiles' : newSelectedFiles };
        }, ()=>{
            if (!analyticsAddFilesToCart){
                return;
            }
            const extData = { list: analytics.hrefToListName(window && window.location.href) };
            analytics.productsAddToCart(newlyAddedFileItems, extData);
            analytics.event(
                "SelectedFilesController",
                "Select Files",
                {
                    eventLabel: extData.list,
                    eventValue: newlyAddedFileItems.length,
                    currentFilters: analytics.getStringifiedCurrentFilters((context && context.filters) || null)
                }
            );
        });
    }

    unselectFile(accessionTriple){
        const { context, analyticsAddFilesToCart = false } = this.props;
        function error(){
            logger.error("Supplied accessionTriple is not a string or array of strings/arrays:", accessionTriple);
            throw new Error("Supplied accessionTriple is not a string or array of strings/arrays:", accessionTriple);
        }

        const newlyRemovedFileItems = [];
        this.setState(({ selectedFiles })=>{
            var newSelectedFiles = _.extend({}, selectedFiles);

            function remove(id) {
                if (typeof newSelectedFiles[id] === 'undefined'){
                    console.log(id, newSelectedFiles);
                    logger.error("File not in set!", id);
                } else {
                    const fileItemCurr = newSelectedFiles[id];
                    if (fileItemCurr){
                        newlyRemovedFileItems.push(fileItemCurr);
                    }
                    delete newSelectedFiles[id];
                }
            }

            if (Array.isArray(accessionTriple)){
                _.forEach(accessionTriple, function(id){
                    if (typeof id === 'string'){
                        remove(id);
                    } else error();
                });
            } else if (typeof accessionTriple === 'string') {
                remove(accessionTriple);
            } else error();

            return { 'selectedFiles' : newSelectedFiles };
        }, ()=>{
            if (!analyticsAddFilesToCart){
                return;
            }
            const extData = { list: analytics.hrefToListName(window && window.location.href) };
            analytics.productsRemoveFromCart(newlyRemovedFileItems, extData);
            analytics.event(
                "SelectedFilesController",
                "Unselect Files",
                {
                    eventLabel: extData.list,
                    eventValue: newlyRemovedFileItems.length,
                    currentFilters: analytics.getStringifiedCurrentFilters((context && context.filters) || null)
                }
            );
        });
    }

    /** @todo: Maybe change to remove all files (not reset to initial) */
    resetSelectedFiles(){
        const { context, initiallySelectedFiles, analyticsAddFilesToCart = false } = this.props;
        const { selectedFiles: existingSelectedFiles } = this.state;
        const existingFileList = _.keys(existingSelectedFiles).map(function(accessionTripleString){
            return existingSelectedFiles[accessionTripleString];
        });
        const selectedFiles = SelectedFilesController.parseInitiallySelectedFiles(initiallySelectedFiles);
        this.setState({ selectedFiles },()=>{
            if (!analyticsAddFilesToCart || existingFileList.length === 0){
                return;
            }
            const extData = { list: analytics.hrefToListName(window && window.location.href) };
            analytics.productsRemoveFromCart(existingFileList, extData);
            analytics.event(
                "SelectedFilesController",
                "Unselect All Files",
                {
                    eventLabel: extData.list,
                    eventValue: existingFileList.length,
                    currentFilters: analytics.getStringifiedCurrentFilters((context && context.filters) || null)
                }
            );
        });
    }

    render(){
        const { children } = this.props;
        const { selectedFiles } = this.state;
        const propsToPass = _.extend(_.omit(this.props, 'children'), {
            'selectedFiles'             : selectedFiles,
            'selectFile'                : this.selectFile,
            'unselectFile'              : this.unselectFile,
            'resetSelectedFiles'        : this.resetSelectedFiles
        });

        if (Array.isArray(children)){
            return React.Children.map(children, function(child){
                if (!React.isValidElement(child)){
                    logger.error('SelectedFilesController expects props.children[] to be valid React component instances.');
                    throw new Error('SelectedFilesController expects props.children[] to be valid React component instances.');
                }
                return React.cloneElement(child, propsToPass);
            });
        } else {
            if (!React.isValidElement(children)){
                logger.error('SelectedFilesController expects props.children to be a valid React component instance.');
                throw new Error('SelectedFilesController expects props.children to be a valid React component instance.');
            }
            return React.cloneElement(children, propsToPass);
        }
    }

}
