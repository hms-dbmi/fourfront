'use strict';

import React from 'react';
import { itemClass, panel_views } from './../globals';
import _ from 'underscore';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import { ItemPageTitle, ItemHeader, ItemDetailList, TabbedView, AuditTabView, ItemFooterRow, WorkflowDetailPane } from './components';
import { ItemBaseView } from './DefaultItemView';
import { console, object, DateUtility, Filters, isServerSide } from './../util';
import Graph, { parseAnalysisSteps, parseBasicIOAnalysisSteps } from './../viz/Workflow';
import { commonGraphPropsFromProps, graphBodyMixin, parseAnalysisStepsMixin, uiControlsMixin, doValidAnalysisStepsExist } from './WorkflowView';

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
 * @class WorkflowRunView
 * @memberof module:item-pages
 * @extends module:item-pages/DefaultItemView.ItemBaseView
 */
export class WorkflowRunView extends React.Component {

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

        var listWithGraph = !doValidAnalysisStepsExist(this.props.context.analysis_steps) ? [] : [
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
                'style' : { minHeight : Math.max(this.state.mounted && !isServerSide() && (window.innerHeight - 180), 100) || 650 }
            });
        });
    }

    render() {
        var schemas = this.props.schemas || {};
        var context = this.props.context;
        var ic = itemClass(this.props.context, 'view-detail item-page-container');

        return (
            <div className={ic}>
                
                <ItemHeader.Wrapper context={context} className="exp-set-header-area" href={this.props.href} schemas={this.props.schemas}>
                    <ItemHeader.TopRow typeInfo={{ title : context.workflow_type, description : 'Workflow Type' }} />
                    <ItemHeader.MiddleRow />
                    <ItemHeader.BottomRow />
                </ItemHeader.Wrapper>

                <br/>

                <div className="row">

                    <div className="col-xs-12 col-md-12 tab-view-container">

                        <TabbedView contents={this.getTabViewContents()} />

                    </div>

                </div>

                <ItemFooterRow context={context} schemas={schemas} />

            </div>
        );
    }

}

class GraphSection extends React.Component {

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
        this.basicGraph = this.basicGraph.bind(this);
        this.detailGraph = this.detailGraph.bind(this);
        this.body = graphBodyMixin.bind(this);
        this.parseAnalysisSteps = parseAnalysisStepsMixin.bind(this);
        this.uiControls = uiControlsMixin.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'showChart' : 'detail',
            'showParameters' : false
        };
    }

    commonGraphProps(){
        var graphData = this.parseAnalysisSteps(); // Object with 'nodes' and 'edges' props.
        return _.extend(commonGraphPropsFromProps(this.props), {
            'isNodeDisabled' : GraphSection.isNodeDisabled,
            'nodes' : mapEmbeddedFilesToStepRunDataIDs( graphData.nodes, allFilesForWorkflowRunMappedByUUID(this.props.context) ),
            'edges' : graphData.edges
        });
    }

    basicGraph(){
        if (!Array.isArray(this.props.context.analysis_steps)) return null;
        return (
            <Graph
                { ...this.commonGraphProps() }
                edgeStyle="curve"
                columnWidth={this.props.mounted && this.refs.container ?
                    (this.refs.container.offsetWidth - 180) / 3
                : 180}
            />
        );
    }

    detailGraph(){
        if (!Array.isArray(this.props.context.analysis_steps)) return null;
        return (
            <Graph
                { ...this.commonGraphProps() }
            />
        );
    }

    static keyTitleMap = {
        'detail' : 'Analysis Steps',
        'basic' : 'Basic Inputs & Outputs',
    }

    render(){

        return (
            <div ref="container" className={"workflow-view-container workflow-viewing-" + (this.state.showChart)}>
                <h3 className="tab-section-title">
                    <span>Graph</span>
                    { this.uiControls() }
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                { this.body() }
            </div>
        );

    }

}

panel_views.register(WorkflowRunView, 'WorkflowRun');
panel_views.register(WorkflowRunView, 'WorkflowRunSbg');
