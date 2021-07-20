'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import queryString from 'query-string';
import _ from 'underscore';
import memoize from 'memoize-one';

import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { console, object, ajax, analytics, memoizedUrlParse, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { requestAnimationFrame as raf } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';

import { Schemas, typedefs } from './../../../util';
import { allFilesFromExperimentSet, filesToAccessionTriples, fileToAccessionTriple } from './../../../util/experiments-transforms';
import { BrowseViewSelectedFilesDownloadButton } from './SelectedFilesDownloadButton';
import { uniqueFileCount, SelectedFilesController } from './../SelectedFilesController';

// eslint-disable-next-line no-unused-vars
const { Item } = typedefs;



export class SelectAllFilesButton extends React.PureComponent {

    /** These are fields included when "Select All" button is clicked to AJAX all files in */
    static fieldsToRequest = [
        'accession',
        'produced_in_pub.display_title',
        'lab.display_title',
        'file_type_detailed',

        'processed_files.accession',
        'processed_files.display_title',
        'processed_files.@id',
        'processed_files.@type',
        'processed_files.file_type_detailed',

        'experiments_in_set.accession',

        'experiments_in_set.files.accession',
        'experiments_in_set.files.display_title',
        'experiments_in_set.files.@id',
        'experiments_in_set.files.@type',
        'experiments_in_set.files.file_type_detailed',

        'experiments_in_set.processed_files.accession',
        'experiments_in_set.processed_files.display_title',
        'experiments_in_set.processed_files.@id',
        'experiments_in_set.processed_files.@type',
        'experiments_in_set.processed_files.file_type_detailed',
    ];

    constructor(props){
        super(props);
        this.isAllSelected = this.isAllSelected.bind(this);
        this.handleSelectAll = this.handleSelectAll.bind(this);
        this.state = { 'selecting' : false };
        this.memoized = {
            uniqueFileCount: memoize(uniqueFileCount)
        };
    }

    isEnabled(){
        const { totalFilesCount } = this.props;
        if (!totalFilesCount) return true;
        if (totalFilesCount > 8000) return false;
        return true;
    }

    isAllSelected(){
        const { totalFilesCount, selectedFiles } = this.props;
        if (!totalFilesCount) return false;
        // totalFilesCount as returned from bar plot aggs at moment is unique.
        if (totalFilesCount === this.memoized.uniqueFileCount(selectedFiles)){
            return true;
        }
        return false;
    }

    handleSelectAll(evt){
        const { selectFile, selectedFiles, resetSelectedFiles, href, context, totalFilesCount } = this.props;
        if (typeof selectFile !== 'function' || typeof resetSelectedFiles !== 'function'){
            logger.error("No 'selectFiles' or 'resetSelectedFiles' function prop passed to SelectedFilesController.");
            throw new Error("No 'selectFiles' or 'resetSelectedFiles' function prop passed to SelectedFilesController.");
        }

        this.setState({ 'selecting' : true }, () => {
            const extData = { list: analytics.hrefToListName(window && window.location.href) };

            if (!this.isAllSelected()){
                const currentHrefParts = memoizedUrlParse(href);
                const currentHrefQuery = _.extend({}, currentHrefParts.query);
                currentHrefQuery.field = SelectAllFilesButton.fieldsToRequest;
                currentHrefQuery.limit = 'all';
                const reqHref = currentHrefParts.pathname + '?' + queryString.stringify(currentHrefQuery);
                ajax.load(reqHref, (resp)=>{
                    let allExtendedFiles;
                    let filesToSelect;
                    if (extData.list === 'browse') {

                        allExtendedFiles = _.reduce(resp['@graph'] || [], (m, v) => m.concat(allFilesFromExperimentSet(v, true)), []);
                        filesToSelect = _.zip(filesToAccessionTriples(allExtendedFiles,true, true), allExtendedFiles);
                    } else {
                        allExtendedFiles =(resp['@graph'] || []);
                        filesToSelect = _.zip(filesToAccessionTriples(allExtendedFiles,false, true), resp['@graph'] );
                    }
                    selectFile(filesToSelect);
                    this.setState({ 'selecting' : false });

                    analytics.event(
                        "SelectAllFilesButton",
                        "Select All",
                        {
                            eventLabel: extData.list,
                            eventValue: totalFilesCount,
                            currentFilters: analytics.getStringifiedCurrentFilters((context && context.filters) || null)
                        }
                    );
                });

            } else {
                resetSelectedFiles();
                this.setState({ 'selecting' : false });
            }
        });
    }

    render(){
        const { selecting } = this.state;
        const isAllSelected = this.isAllSelected();
        const isEnabled = this.isEnabled();
        const iconClassName = (
            "mr-05 icon icon-fw icon-" + (selecting ? 'circle-notch icon-spin fas' : (isAllSelected ? 'square far' : 'check-square far'))
        );
        const cls = "btn " + (isAllSelected ? "btn-outline-primary" : "btn-primary");

        return (
            <div className="pull-left box selection-buttons">
                <div className="btn-group">
                    <button type="button" id="select-all-files-button" disabled={selecting || (!isAllSelected && !isEnabled)}
                        className={cls} onClick={this.handleSelectAll}>
                        <i className={iconClassName}/>
                        <span className="d-none d-md-inline text-400">{ isAllSelected ? 'Deselect' : 'Select' } </span>
                        <span className="text-600">All</span>
                    </button>
                </div>
            </div>
        );
    }
}


const FileTypeBucketCheckbox = React.memo(function FileTypeBucketCheckbox(props){
    const { fileType, onFileTypeClick, files, fileTypeFilters } = props;
    const selected = Array.isArray(fileTypeFilters) && fileTypeFilters.indexOf(fileType) > -1;
    const filesLength = files.length;
    const cls = "text-truncate" + (selected ? ' is-active' : '');
    function onChange(evt){ onFileTypeClick(fileType); }

    let title;
    if (typeof fileType === 'undefined' || fileType === 'other' || fileType === 'undefined'){
        title = "Other";
    } else {
        title = Schemas.Term.toName('files.file_type_detailed', fileType);
    }

    const tip = (
        (selected ? 'Remove ' : 'Include ')
        + filesLength + ' ' + title + ' files' +
        (selected ? ' from ' : ' to ') + 'selection.'
    );

    return (
        <div className="col-sm-6 col-lg-4 file-type-checkbox" key={fileType} data-tip={tip}>
            <Checkbox key={fileType} checked={selected} onChange={onChange} className={cls}>
                { title } <sub>({ filesLength })</sub>
            </Checkbox>
        </div>
    );
});


export class SelectedFilesFilterByContent extends React.PureComponent {

    /**
     * @param {Object} format_buckets               File Type Details (keys) + lists of files (values)
     * @param {function} onFileTypeClick            Function to handle button click. Accepts fileTypeDetail as first param before MouseEvt.
     * @param {string[]|null} fileTypeFilters       List of currently filtered-in filetype, if any.
     * @returns {JSX.Element[]} List of JSX Button elements.
     */
    static renderFileFormatButtonsFromBuckets(format_buckets, onFileTypeClick, fileTypeFilters){
        return _.map(_.sortBy(_.pairs(format_buckets), function([fileType, filesForType]){ return -filesForType.length; }), function([fileType, files]){
            return <FileTypeBucketCheckbox {...{ fileType, onFileTypeClick, files, fileTypeFilters }} key={fileType} />;
        });
    }

    /**
     * Converts `selectedFiles` structure into groups of `file_type_detailed` property.
     * Also uniqs the files in order to align with download button count & quick info bar.
     *
     * @param {Object.<Item>} selectedFiles - Object of files, keyed by accession triple string.
     * @returns {Object.<Item>} Object of files, keyed by `file_type_detailed` property,
     */
    static filesToFileTypeBuckets = memoize(function(selectedFiles){
        const selectedFilesUniqueList = _.uniq(_.values(selectedFiles), false, 'accession');
        return _.groupBy(selectedFilesUniqueList, 'file_type_detailed');
    });

    static propTypes = {
        'selectedFiles' : PropTypes.object.isRequired,
        'currentFileTypeFilters' : PropTypes.arrayOf(PropTypes.string).isRequired,
        'setFileTypeFilters' : PropTypes.func.isRequired,
        'onClosePanel' : PropTypes.func
    };

    constructor(props){
        super(props);
        this.onClick = this.onClick.bind(this);
    }

    /** Adds `filterString` to filters if not present, else removes it. */
    onClick(filterString, evt){
        const { currentFileTypeFilters, setFileTypeFilters } = this.props;
        const fileTypeFilters = currentFileTypeFilters.slice(0);
        const indexOfNewFilter = fileTypeFilters.indexOf(filterString);
        if (indexOfNewFilter < 0){ // Append
            fileTypeFilters.push(filterString);
        } else { // Remove
            fileTypeFilters.splice(indexOfNewFilter, 1);
        }
        setFileTypeFilters(fileTypeFilters);
    }

    render(){
        const { selectedFiles, currentFileTypeFilters } = this.props;
        if (!selectedFiles) return null;
        const fileTypeButtons = SelectedFilesFilterByContent.renderFileFormatButtonsFromBuckets(
            SelectedFilesFilterByContent.filesToFileTypeBuckets(selectedFiles),
            this.onClick,
            currentFileTypeFilters
        );
        return <div className="row">{ fileTypeButtons }</div>;
    }

}


const SelectedFilesFilterByButton = React.memo(function SelectedFilesFilterByButton(props){
    const { selectedFiles, currentFileTypeFilters, onFilterFilesByClick, active } = props;
    const isDisabled = !selectedFiles || _.keys(selectedFiles).length === 0;
    const currentFiltersLength = currentFileTypeFilters.length;
    const tooltip = "<div class='text-center'>Filter down selected files based on their file type.<br/>(does not affect checkboxes below)</div>";
    const cls = "btn btn-primary" + (active ? " active" : "");

    return (
        <button type="button" id="selected-files-file-type-filter-button" className={cls} onClick={onFilterFilesByClick}
            key="filter-selected-files-by" disabled={isDisabled} active={active.toString()} data-tip={tooltip} data-html>
            <i className="icon icon-filter fas icon-fw mr-05" style={{ opacity : currentFiltersLength > 0 ? 1 : 0.75 }}/>
            {
                currentFiltersLength > 0 ? <span>{ currentFiltersLength } </span> : (
                    <span className="d-none d-lg-inline">All </span>
                )
            }
            <span className="text-400 d-none d-lg-inline mr-05">{ "File Type" + (currentFiltersLength === 1 ? '' : 's') }</span>
            <i className="icon icon-angle-down icon-fw fas"/>
        </button>
    );
});


export const SelectedFilesControls = React.memo(function SelectedFilesControls(props){
    const {
        href, context, session,
        selectedFiles, subSelectedFiles,
        currentFileTypeFilters,
        setFileTypeFilters,
        barplot_data_filtered,
        barplot_data_unfiltered,
        currentOpenPanel
    } = props;
    const selectedFileProps = SelectedFilesController.pick(props);

    let totalUniqueFilesCount;
    if (Array.isArray(context['@type']) && context['@type'].indexOf('FileSearchResults') > -1) {
        totalUniqueFilesCount = context.total || 0;
    } else {
        const barPlotData = (barplot_data_filtered || barplot_data_unfiltered);
        // This gets unique file count from ES aggs. In future we might be able to get total including
        // duplicates, in which case should change up logic downstream from this component for e.g. `isAllSelected`
        // in SelectAllFilesButton & similar.
        totalUniqueFilesCount = (barPlotData && barPlotData.total && barPlotData.total.files) || 0;
    }

    return (
        // This rendered within a row by AboveTableControlsBase.js
        // TODO maybe refactor some of this stuff to be simpler.
        <div className="col">
            <SelectAllFilesButton {...selectedFileProps} {...{ href, context }} totalFilesCount={totalUniqueFilesCount} />
            <div className="pull-left box selection-buttons">
                <div className="btn-group">
                    <BrowseViewSelectedFilesDownloadButton {...{ selectedFiles, subSelectedFiles, context, session }} totalFilesCount={totalUniqueFilesCount} />
                    <SelectedFilesFilterByButton totalFilesCount={totalUniqueFilesCount} onFilterFilesByClick={props.panelToggleFxns.filterFilesBy}
                        active={currentOpenPanel === "filterFilesBy"} // <- must be boolean
                        {...selectedFileProps} {...{ currentFileTypeFilters, setFileTypeFilters, currentOpenPanel }} />
                </div>
            </div>
        </div>
    );
});
