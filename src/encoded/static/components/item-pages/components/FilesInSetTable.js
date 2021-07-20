'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import { console, object, analytics, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { downloadFileButtonClick } from './../../util/file';



/**
 * Show the submitter's name and link to their profile.
 * If passed a props.labName and props.showLabName == true,
 * then will show that labName instead. Use for when hovering over the lab icon, for example.
 *
 * Also shows props.labName if no props.user object supplied.
 *
 * @memberof module:item-pages/components.FilesInSetTable
 * @class SubmitterLink
 * @type {Component}
 * @prop {Object} user - User object.
 * @prop {Object} user.display_title - User's name to display.
 * @prop {string} labName - Name of Lab to show if props.showLabName is true.
 * @prop {boolean} [showLabName=false] - Show lab name instead of props.user.display_title if true.
 */
const SubmitterLink = React.memo(function SubmitterLink({ user, labName, showLabName }){
    if (labName && (showLabName || !user)){
        return (
            <span>
                <small>Lab: </small>{ labName }
            </span>)
        ;
    }

    const atId = object.atIdFromObject(user);
    const title = user.display_title || user.title || (typeof user === 'string' ? user : null) || "Submitter";
    if (!atId && title === 'Submitter') return null;
    else if (!atId) return title;

    return (
        <span>
            <a href={atId}>{ title }</a>
        </span>
    );
});


/**
 * Renders a "users group" icon which links to submitter's lab.
 *
 * @todo Move somewhere, re-use in columnExtensionMap.js to avoid redundancy.
 * @prop {Object} lab - Lab object.
 * @prop {function} onMouseEnter - Callback for cursor entering icon.
 * @prop {function} onMouseLeave - Callback for cursor leaving icon.
 */
const LabIcon = React.memo(function LabIcon(props){
    const { lab, onMouseEnter, onMouseLeave } = props;
    const atId = lab && object.atIdFromObject(lab);
    if (!atId){
        logger.error("We need lab with @id.");
        return (
            <span className="lab-icon no-lab">
                <i className="icon icon-users fas"/>
            </span>
        );
    }
    return (
        <a href={atId} className="lab-icon d-inline-block" data-tip={lab.display_title}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <i className="icon icon-users fas"/>
        </a>
    );
});
LabIcon.defaultProps = {
    onMouseEnter : null,
    onMouseLeave : null
};

/**
 * Renders a div element with '.row' Bootstrap class, containing details about a file.
 * Meant to fill a large-width area, but scales down responsively for smaller screen sizes.
 */
export const FileItemRow = React.memo(function FileItemRow(props){
    const { file } = props;
    const atId = object.atIdFromObject(file);
    const {
        display_title,
        accession,
        href: fileDownloadHref = null,
        file_format: { display_title: fileFormat } = {},
        attachment: { type: attachmentType } = {}
    } = file || {};

    const title = display_title || accession;

    const attachmentDownloadHref = FilesInSetTable.attachmentDownloadLinkFromFile(file);
    const fileItemClass = FilesInSetTable.iconClassFromFileType(fileFormat);
    const attachmentIconClass = FilesInSetTable.iconClassFromFileType(attachmentType);

    function onClick(evt){ downloadFileButtonClick(file); }

    return (
        <div className="row" key={atId || title}>
            <div className="col col-6 col-lg-2 title">
                <h6 className="accession">
                    { atId ? <a href={atId}>{ title }</a> : title }
                </h6>
            </div>

            <div className="col col-6 col-lg-2 download-button d-flex align-items-center justify-content-between">
                <a className="btn btn-primary btn-sm button-dl-file" onClick={onClick}
                    href={fileDownloadHref} download disabled={!fileDownloadHref}>
                    <i className={"icon icon-" + (fileItemClass) }/>
                    { '\u00A0  Download' }
                </a>
                <a href={attachmentDownloadHref} download disabled={!attachmentDownloadHref}
                    className={"btn btn-sm btn-outline-dark button-dl-doc" + (!attachmentDownloadHref ? ' disabled' : '')}>
                    <i className={"icon icon-" + (attachmentIconClass || 'file far')}/>
                </a>
            </div>

            <div className="col-12 col-lg-4 col-xl-5 description">
                { file.description }
            </div>

            <div className="col-1 col-md-1 lab">
                <LabIcon
                    lab={file && file.lab}
                />
            </div>

            <div className="col-11 col-md-3 col-lg-2 submitter">
                <SubmitterLink
                    user={file && file.submitted_by}
                />
            </div>

            <div className="col-12 col-md-12 divider-column">
                <div className="divider"/>
            </div>
        </div>
    );
});



/** These props are shared between FilesInSetTable and FilesInSetTable.Small */
const propTypes = {
    'files' : PropTypes.arrayOf(PropTypes.shape({
        'accession'       : PropTypes.string,
        'display_title'   : PropTypes.string,
        'attachment'      : PropTypes.shape({ 'download' : PropTypes.string }).isRequired,
        'description'     : PropTypes.string.isRequired
    })).isRequired
};


/** Small version of the full-width FilesInSetTable. Used for default item view page SubIPanels. */
export const Small = React.memo(function Small({ files }){
    return (
        <div className="files-in-set-table smaller-version">
            {
                files.map(function(file, i){
                    const atId = object.atIdFromObject(file);
                    const title = file.display_title || file.accession;
                    const downloadHref = FilesInSetTable.attachmentDownloadLinkFromFile(file);
                    return (
                        <div className="row" key={atId || title || i}>
                            <div className="col-12 col-md-4 title">
                                <h6 className="text-500">
                                    { atId ? <a href={atId}>{ title }</a> : title }
                                </h6>
                            </div>
                            <div className="col-12 col-md-6 description">
                                { file.description }
                            </div>
                            <div className="col-12 col-md-2 text-right download-button">
                                <a className="btn btn-sm btn-primary" href={downloadHref} download disabled={!downloadHref}>
                                    <i className="icon fas icon-download"/>
                                </a>
                            </div>
                        </div>
                    );
                })
            }
        </div>
    );
});
Small.propTypes = propTypes;


/**
 * Component for displaying Files from a list.
 *
 * @todo Maybe make into functional component.
 * @prop {Object[]} files - List of file objects, e.g. a FileCalbirationSet's 'files_in_set' property.
 */
export class FilesInSetTable extends React.PureComponent {

    static Small = Small;

    static getTabObject(context, title, schemas = null){
        title = title || 'Files in Set';
        return {
            tab : <span><i className="icon icon-list-ul fas icon-fw"/> { title }</span>,
            key : 'files_in_set',
            content : (
                <div className="overflow-hidden">
                    <h3 className="tab-section-title">
                        <span>{ title }</span>
                    </h3>
                    <hr className="tab-section-title-horiz-divider"/>
                    <FilesInSetTable files={context.files_in_set}/>
                </div>
            )
        };
    }

    /**
     * Generate a download link for a file attachment from a fileObject, which should represent a (partial) JSON of a file Item.
     *
     * @param {Object} fileObject - Object must have an @id property, as well as an 'attachment' property containing 'href'.
     * @returns {string} URL to download file attachment from.
     */
    static attachmentDownloadLinkFromFile(fileObject){
        var downloadLinkExists = true;
        var atId = object.atIdFromObject(fileObject);
        var downloadHref = (fileObject && fileObject.attachment && fileObject.attachment.href) || null;
        if (!downloadHref) return null;

        if (typeof downloadHref === 'string' && downloadHref.charAt(0) !== '/'){
            // Assume relative link, relative to Item not this set however.
            if (atId){
                var fileItemURLPath = url.parse(atId).pathname;
                return fileItemURLPath + (fileItemURLPath.slice(-1) === '/' ? '' : '/') + downloadHref;
            } else {
                return null;
            }
        } else if (typeof downloadHref === 'string') {
            return downloadHref;
        }

        return null;
    }

    /**
     * Converts a file-type or mime-type string into a FontAwesome icon className suffix.
     *
     * @param {string} fileType - MIMEType to get icon className suffix for.
     * @returns {string|null} The suffix to append to "fa-" or "icon-" CSS class.
     */
    static iconClassFromFileType(fileType){
        if (typeof fileType !== 'string') return 'file far';
        fileType = fileType.toLowerCase();
        if (fileType.indexOf('zip') > -1){
            return 'file-zip far';
        } else if ( fileType.indexOf('pdf') > -1 ){
            return 'file-pdf far';
        } else if ( fileType.indexOf('doc') > -1 ){
            return 'file-word far';
        } else if (
            fileType.indexOf('txt') > -1 ||
            fileType.indexOf('tex') > -1
        ){
            return 'file-alt far';
        } else if (
            fileType.indexOf('xls') > -1 ||
            fileType.indexOf('csv') > -1 ||
            fileType.indexOf('tsv') > -1
        ){
            return 'file-excel far';
        } else if (
            fileType.indexOf('png') > -1 ||
            fileType.indexOf('tiff') > -1 ||
            fileType.indexOf('jpg') > -1 ||
            fileType.indexOf('jpeg') > -1 ||
            fileType.indexOf('svg') > -1
        ){
            return 'file-picture far';
        } else {
            return 'file far';
        }
    }

    static propTypes = propTypes;

    /**
     * Renders heading with titles for table on medium and large width screens.
     *
     * @returns {JSX.Element} <div> element
    */
    header(){
        return (
            <div className="row d-none d-lg-flex header-row">
                <div className="col-9 col-lg-2 title">
                    Accession
                </div>

                <div className="col-3 col-lg-2 text-right download-button-title pull-right">
                    {/* <i className="icon icon-download"/> */}
                    <span className="file">Image Files</span>
                    <span className="docs">Doc</span>
                </div>

                <div className="col-12 col-lg-4 col-xl-5 description">
                    Description
                </div>

                <div className="col-1 lab" style={{ paddingRight : 6 }}>
                    Lab
                </div>

                <div className="col-12 col-lg-2 submitter">
                    Submitter
                </div>

                <div className="col-12 col-md-12 divider-column">
                    <div className="divider"/>
                </div>
            </div>
        );
    }

    render(){
        return (
            <div className="files-in-set-table">
                { this.header() }
                { this.props.files.map((file, i)=> <FileItemRow file={file} key={object.itemUtil.atId(file) || i} />) }
            </div>
        );
    }

}
