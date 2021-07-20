'use strict';

import React from 'react';
import _ from 'underscore';
import { FileEntryBlock } from '../../browse/components/FileEntryBlock';
import { expFxn, Schemas } from './../../util';
import { console, object, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { StackedBlockTable, StackedBlock, StackedBlockList, StackedBlockName, StackedBlockNameLabel } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/StackedBlockTable';

/**
 * Reusable Component for showing Aliases, External References, etc.
 * Shown at bottom of Item pages.
 *
 * @class ItemFooterRow
 * @type {Component}
 * @prop {Object} context - JSON representation of current Item object. Should be available through Redux store's context.
 * @prop {Object} schemas - JSON representation of sitewide schemas.
 * @prop {number} width - Used to define ExternalReferencesStackedTable's width
 */
export const ItemFooterRow = React.memo(function ItemFooterRow({ context, schemas, width }) {
    const { aliases = [], actions = [], external_references = [], alternate_accessions = [] } = context || {};

    const types = context && context['@type'] && Array.isArray(context['@type']) ? context['@type'] : [];
    const renderAsTable = (types.indexOf('ExperimentSet') > -1 || types.indexOf('Experiment') > -1);

    if (renderAsTable) {
        const altAccessionTitle = (<h3 className="tab-section-title">Alternate Accessions</h3>);
        return (
            <div className="row">
                <ExternalReferencesStackedTable {...{ context, width }} />
                {/* <AliasesSection context={context} aliases={aliases} actions={actions} /> */}
                <AlternateAccessionSection context={context} alternateAccessions={alternate_accessions} title={altAccessionTitle} />
            </div>
        );
    } else {
        if (external_references.length === 0 && alternate_accessions.length === 0) {
            return null;
        }
        return (
            <React.Fragment>
                <hr className="mb-08 mt-1" />
                <div className="row">
                    <ExternalReferencesSection context={context} externalReferences={external_references} />
                    {/* <AliasesSection context={context} aliases={aliases} actions={actions} /> */}
                    <AlternateAccessionSection context={context} alternateAccessions={alternate_accessions} />
                </div>
            </React.Fragment>
        );
    }
});


function ExternalReferencesSection({ externalReferences }){
    if (externalReferences.length === 0){
        return null;
    }
    return (
        <div className="col col-12 col-md-6">
            <h4 className="text-300">External References</h4>
            <div>
                <ul>
                    { _.map(externalReferences, function(extRef, i){
                        return (
                            <li key={i}>
                                { typeof extRef.ref === 'string' ?
                                    <ExternalReferenceLink uri={extRef.uri || null}>{ extRef.ref }</ExternalReferenceLink> : extRef
                                }
                            </li>
                        );
                    }) }
                </ul>
            </div>
        </div>
    );
}

function AlternateAccessionSection({ alternateAccessions, title }){
    if (alternateAccessions.length === 0){
        return null;
    }
    return (
        <div className="col col-12 col-md-6">
            {title || (<h4 className="text-300">Alternate Accessions</h4>)}
            <div>
                <ul>
                    { _.map(alternateAccessions, function(altAccession, i){
                        return (
                            <li key={i}>{ altAccession }</li>
                        );
                    }) }
                </ul>
            </div>
        </div>
    );
}

function AliasesSection({ aliases, actions }){
    if (aliases.length === 0) return null;

    if (!_.find(actions, { 'name' : 'edit' })) return null; // No 'Edit' action for this Item.

    return (
        <div>
            <h4 className="text-500">Aliases</h4>
            <div>
                <ul>
                    { _.map(aliases, function(alias, i){
                        return (
                            <li key={i}>{ alias }</li>
                        );
                    }) }
                </ul>
            </div>
        </div>
    );
}

/**
 * Used to display an external reference link.
 *
 * @prop {Component[]|Element[]|string[]} children - Inner contents or title of link.
 * @prop {string} uri - The href for the link.
 */
export function ExternalReferenceLink({ uri, children }){
    if (!uri || (typeof uri === 'string' && uri.length < 8)){
        // < 8 because that's minimum we need for a URL (e.g. 'http://' is first 7 chars)
        return <span className="external-reference">{ children }</span>;
    }

    return (
        <a href={uri} target="_blank" rel="noopener noreferrer" className="external-reference">{ children }</a>
    );
}

/**
 * External references table to display all external_references of
 * experiment set/experiment.
 *
 * If context['@type'] is ExperimentSet, collects
 * 1. direct external_references of the experiment set
 * 2. processed_files' external_references of the experiment set
 * then iterates through experiments_in_set and collects each experiment's
 * 3. direct external_references
 * 4. raw and processed files' external_references.
 *
 * If context['@type'] is Experiment, collects
 * 1. direct external_references of the experiment
 * 2. raw and processed files' external_references of the experiment.
 */
export const ExternalReferencesStackedTable = React.memo(function ExternalReferencesStackedTable({ context, width }) {
    if (!!context && context['@type'].indexOf('ExperimentSet') === -1 && context['@type'].indexOf('Experiment') === -1) {
        logger.error('Only types of Experiment Set and Experiment are supported');
        throw new Error('Only types of Experiment Set and Experiment are supported');
    }

    const {
        accession, experiments_in_set = [], replicate_exps = [],
    } = context;

    //files iteratee function
    const getCombinedTriplesFromFileFunc = function (files, experiment) {
        const result = [];
        if (files && files.length > 0) {
            _.each(files, function (file) {
                if (file.external_references && file.external_references.length > 0) {
                    result.push({ experiment: experiment, file: file, externalRefs: file.external_references });
                }
            });
        }
        return result;
    };
    //rendering functions
    const renderFileColFunc = function (file, field, detailIndex, fileEntryBlockProps) {
        const { file_type_detailed } = file;
        const fileAtId = object.atIdFromObject(file);
        if (!!fileAtId && fileAtId === '-') {
            return (<span className="title-of-file text-monospace name-title" >&nbsp;</span>);
        }

        let fileTitleString;
        if (file.accession) {
            fileTitleString = file.accession;
        }
        if (!fileTitleString && fileAtId) {
            var idParts = _.filter(fileAtId.split('/'));
            if (idParts[1].slice(0, 5) === '4DNFI') {
                fileTitleString = idParts[1];
            }
        }
        if (!fileTitleString) {
            fileTitleString = file.uuid || fileAtId || 'N/A';
        }
        return (
            <React.Fragment>
                <div>{Schemas.Term.toName("file_type_detailed", file_type_detailed, true)}</div>
                <a className="title-of-file text-monospace name-title" href={fileAtId}>
                    {fileTitleString}
                </a>
            </React.Fragment>);
    };
    const renderExtRefColFunc = function (file, field, detailIndex, fileEntryBlockProps) {
        if (!file.external_references || !Array.isArray(file.external_references) || file.external_references.length === 0) {
            return <span className="text-monospace">-</span>;
        }
        const getExtRefLink = function (externalRef, file) {
            if (externalRef && typeof externalRef.ref === 'string') {
                const innerText = (file.accession !== '-') ? externalRef.ref : (<span className="font-weight-bold">{externalRef.ref}</span>);
                return <ExternalReferenceLink uri={externalRef.uri || null}>{innerText}</ExternalReferenceLink>;
            } else {
                return { externalRef };
            }
        };

        const { external_references } = file;
        const [externalRef] = external_references;
        return (
            external_references.length > 1 ? (
                <ul>
                    {_.map(external_references, function (externalRef, i) {
                        return <li>{getExtRefLink(externalRef, file)}</li>;
                    })}
                </ul>) : (<React.Fragment>{getExtRefLink(externalRef, file)}</React.Fragment>)
        );
    };

    const columnHeaders = [
        { columnClass: 'experiment', title: 'Experiment', initialWidth: 200, className: 'text-left' },
        { columnClass: 'file', title: 'File', initialWidth: 200, render: renderFileColFunc },
        { columnClass: 'file-detail', title: 'External References', initialWidth: 200, render: renderExtRefColFunc },
    ];

    // combined object for experiment - file - external references fields: {experiment, file, externalRefs}
    let combinedTriples = [];
    let experiments = null;

    if (context['@type'].indexOf('ExperimentSet') > -1) {
        //add experiment set's refs
        if (context.external_references && context.external_references.length > 0) {
            combinedTriples.push({ experiment: null, file: null, externalRefs: context.external_references });
        }
        //add experiment set's processed files' refs
        combinedTriples = combinedTriples.concat(getCombinedTriplesFromFileFunc(context.processed_files, null));
        //combine experiment sets w/ bio/tech replicate numbers
        experiments = expFxn.combineWithReplicateNumbers(replicate_exps, experiments_in_set);
        //add Experiment Set column
        columnHeaders.splice(0, 0, { columnClass: 'experiment-set', title: 'Experiment Set', initialWidth: 200, className: 'text-left' });
    } else {
        experiments = [context];//Currently, we do not add the replicate numbers for type 'Experiment'
    }

    //itereate through the experiments
    _.each(experiments, function (exp) {
        //add experiment's refs
        if (exp.external_references && exp.external_references.length > 0) {
            combinedTriples.push({ experiment: exp, file: null, externalRefs: exp.external_references });
        }
        //add experiment's processed files' refs
        combinedTriples = combinedTriples.concat(getCombinedTriplesFromFileFunc(exp.processed_files, exp));
        //add experiment's raw files' refs
        combinedTriples = combinedTriples.concat(getCombinedTriplesFromFileFunc(exp.files, exp));
    });

    if (combinedTriples.length == 0) {
        return null;
    }

    const combinedTriplesGroupByExp = _.groupBy(combinedTriples, function (item) { return (item.experiment && item.experiment.accession) || '-'; });

    const experimentBlocks = _.map(combinedTriplesGroupByExp, function (combinedTriples, idx) {
        const fileBlocks = _.map(combinedTriples, function (combinedTriple) {
            const file = combinedTriple.file || { accession: '-', '@id': '-', external_references: combinedTriple.externalRefs };
            const renderFileLabel = !!combinedTriple.file;
            return (<FileEntryBlock file={file} label={renderFileLabel ? <StackedBlockNameLabel title="File" /> : null}></FileEntryBlock>);
        });
        const [combinedTriple] = combinedTriples;
        const { experiment } = combinedTriple;
        const experimentAtId = object.itemUtil.atId(experiment);
        const text = (experiment && experiment.display_title) || null;
        const replicateNumbersExists = experiment && experiment.bio_rep_no && experiment.tec_rep_no;
        return (
            <StackedBlock columnClass="experiment" hideNameOnHover={false} key={"exp-" + idx}
                label={experimentAtId ? <StackedBlockNameLabel title="Experiment" subtitle={null} accession={(experiment && experiment.accession) || null} subtitleVisible /> : null}>
                <StackedBlockName relativePosition={true} className={experimentAtId ? '' : 'name-empty'}>
                    {replicateNumbersExists ? <div>Bio Rep <b>{experiment.bio_rep_no}</b>, Tec Rep <b>{experiment.tec_rep_no}</b></div> : <div />}
                    {experimentAtId ? (<a href={experimentAtId} className="name-title">{text}</a>) : (text ? (<div className="name-title">{text}</div>) : null)}
                </StackedBlockName>
                <StackedBlockList title="Files" collapseLongLists={false} collapseLimit={10}>
                    {fileBlocks}
                </StackedBlockList>
            </StackedBlock>
        );
    });

    return (
        <div className="col">
            <h3 className="tab-section-title">External References</h3>
            <div className="stacked-block-table-outer-container overflow-auto">
                <StackedBlockTable columnHeaders={columnHeaders} className="external-references-stacked-table" fadeIn width={width}>
                    {context['@type'].indexOf('ExperimentSet') > -1 ? (
                        <StackedBlockList collapseLongLists={false}>
                            <StackedBlock columnClass="experiment-set" hideNameOnHover={false} key="expset"
                                label={<StackedBlockNameLabel title="Experiment Set" subtitle={null} accession={accession} subtitleVisible />}>
                                <StackedBlockName relativePosition={true}>
                                    <a href={context['@id']} className="name-title">{accession}</a>
                                </StackedBlockName>
                                <StackedBlockList title="Experiments" collapseLongLists={true} collapseLimit={10}>
                                    {experimentBlocks}
                                </StackedBlockList>
                            </StackedBlock>
                        </StackedBlockList>
                    ) : (<StackedBlockList collapseLongLists={false} collapseLimit={10}>{experimentBlocks}</StackedBlockList>)}
                </StackedBlockTable>
            </div>
        </div>
    );
});