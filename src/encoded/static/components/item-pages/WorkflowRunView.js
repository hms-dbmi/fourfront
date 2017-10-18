'use strict';

import React from 'react';
import { itemClass, panel_views } from './../globals';
import _ from 'underscore';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import { ItemPageTitle, ItemHeader, ItemDetailList, TabbedView, AuditTabView, ItemFooterRow, WorkflowDetailPane } from './components';
import { ItemBaseView } from './DefaultItemView';
import { console, object, DateUtility, Filters, isServerSide } from './../util';
import Graph, { parseAnalysisSteps, parseBasicIOAnalysisSteps } from './../viz/Workflow';
import { commonGraphPropsFromProps, parseAnalysisStepsMixin, doValidAnalysisStepsExist, WorkflowGraphSection, WorkflowGraphSectionControls } from './WorkflowView';

// Test/Debug Data
//import { WFR_JSON } from './../testdata/traced_workflow_runs/WorkflowRunSBG-4DNWF06BPEF2';


/**
 * N.B. CAUSES SIDE EFFECTS (PURPOSELY)
 * Replaces n.meta.run_data.file UUID with embedded object from input_files or output_files, or output_quality_metrics (assuming they are in param uuidFileMap).
 * Adjusts the node in array of passed in nodes, does NOT return a copy of node. This is so  Edge will maintain reference to its nodes rather than needing to reconnect edge to a copied/new node.
 * 
 * @param {Object[]} nodes - List of all nodes for Workflow Graph Viz, e.g. as generated by parseAnalysisSteps func.
 * @param {Object.<Object>} uuidFileMap - Mapping of UUIDs to File Item objects. Should be derived from input_files, output_files, output_quality_metrics.
 * @returns {Object[]} List of nodes with their 'meta.run_data.file' value replaced from UUID to File item object.
 */
export function mapEmbeddedFilesToStepRunDataIDs(nodes, uuidFileMap){

    return _.map(nodes, function(n){
        if (!n.meta || !n.meta.run_data || !n.meta.run_data.file) return n;
        if (typeof n.meta.run_data.file !== 'string') return n;
        
        var fileUUID;
        try {
            fileUUID = object.assertUUID(n.meta.run_data.file);
        } catch (e) {
            console.error(e);
            return n;
        }

        var matchingFile = uuidFileMap[fileUUID];
        if (matchingFile && typeof matchingFile === 'object'){
            n.meta.run_data = _.extend({}, n.meta.run_data, {
                'file' : matchingFile
            });
        }
        return n;
    });
}

export function allFilesForWorkflowRunMappedByUUID(item){
    return _.object(
        _.map(
            _.filter(
                _.pluck(
                    (item.output_files || []).concat(item.input_files || []).concat(item.output_quality_metrics || []),
                    'value'
                ),
                function(file){
                    if (!file || typeof file !== 'object') {
                        console.error("No file ('value' property) embedded.");
                        return false;
                    }
                    if (typeof file.uuid !== 'string') {
                        console.error("We need to have Files' UUID embedded in WorkflowRun-> output_files, input_files, & output_quality_metric in order to have file info appear on workflow viz nodes.");
                        return false;
                    }
                    return true;
                }
            ),
            function(file){
                return [
                    file.uuid,                                  // Key
                    _.extend({}, file, {                        // Value
                        '@id' : object.atIdFromObject(file)
                    })
                ];
            }
        )
    );
}

/**
 * @export
 * @extends module:item-pages/DefaultItemView.ItemBaseView
 */
export class WorkflowRunView extends ItemBaseView {

    constructor(props){
        super(props);
        this.render = this.render.bind(this);
        this.getTabViewContents = this.getTabViewContents.bind(this);
        this.state = {
            mounted : false
        };
    }

    componentDidMount(){
        this.setState({ mounted : true });
    }

    getTabViewContents(){

        var listWithGraph = !doValidAnalysisStepsExist(this.props.context.steps) ? [] : [
            {
                tab : <span><i className="icon icon-code-fork icon-fw"/> Graph & Summary</span>,
                key : 'graph',
                content : <GraphSection {...this.props} mounted={this.state.mounted} />
            }
        ];

        return listWithGraph.concat([
            ItemDetailList.getTabObject(this.props.context, this.props.schemas),
            AuditTabView.getTabObject(this.props.context)
        ]).map((tabObj)=>{ // Common properties
            return _.extend(tabObj, {
                'style' : { minHeight : Math.max(this.state.mounted && !isServerSide() && (window.innerHeight - 180), 100) || 800 }
            });
        });
    }

    itemHeader(){
        var context = this.props.context;
        var topRightTitle = (context.workflow && context.workflow.display_title) || null;
        if (topRightTitle && context.workflow.workflow_type){
            topRightTitle = (
                <span><span className="text-400">{ topRightTitle }</span> | { context.workflow.workflow_type }</span>
            );
        }
        return (
            <ItemHeader.Wrapper context={context} className="exp-set-header-area" href={this.props.href} schemas={this.props.schemas}>
                <ItemHeader.TopRow typeInfo={{ title : topRightTitle, description : 'Workflow Type' }} />
                <ItemHeader.MiddleRow />
                <ItemHeader.BottomRow />
            </ItemHeader.Wrapper>
        );
    }

}

class GraphSection extends WorkflowGraphSection {

    static isNodeDisabled(node){
        if (node.type === 'step') return false;
        if (node && node.meta && node.meta.run_data){
            return false;
        }
        return true;
    }

    constructor(props){
        super(props);
        this.commonGraphProps = this.commonGraphProps.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'showChart' : 'detail',
            'showParameters' : false,
            'rowSpacingType' : 'compact',
            'fullscreenViewEnabled' : false
        };
    }

    commonGraphProps(){
        var graphData = this.parseAnalysisSteps(); // Object with 'nodes' and 'edges' props.

        var legendItems = _.clone(WorkflowDetailPane.Legend.defaultProps.items);
        // Remove Items which aren't relevant for this context.
        delete legendItems['Current Context'];
        delete legendItems['Group of Similar Files'];
        if (!this.state.showParameters){
            delete legendItems['Input Parameter'];
        }
        if (this.state.showChart === 'basic'){
            delete legendItems['Intermediate File'];
        }

        return _.extend(commonGraphPropsFromProps(
            _.extend({ legendItems }, this.props)
        ), {
            'isNodeDisabled' : GraphSection.isNodeDisabled,
            'nodes' : mapEmbeddedFilesToStepRunDataIDs( graphData.nodes, allFilesForWorkflowRunMappedByUUID(this.props.context) ),
            'edges' : graphData.edges,
            'rowSpacingType' : this.state.rowSpacingType
        });
    }

}

panel_views.register(WorkflowRunView, 'WorkflowRun');
panel_views.register(WorkflowRunView, 'WorkflowRunSbg');
