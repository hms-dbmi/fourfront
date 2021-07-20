'use strict';

import React from 'react';
import _ from 'underscore';
import { barplot_color_cycler } from './../ColorCycler';
import { console, object, isServerSide, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
// `Schemas` kept for project-specific transforms
import { Schemas } from './../../util';
import CursorComponent from './CursorComponent';

/**
 * A plain JS object which contains at least 'title' and 'function' properties.
 * These become transformed into buttons.
 * @todo Refactor lil bit
 *
 * @typedef {Object} Action
 * @property {string} title - Title or text of the button to be shown.
 * @property {function} function - A function to be called when the button is pressed.
 * @property {string} bsStyle - Bootstrap color style to use for button. Optional.
 */


class Body extends React.PureComponent {

    constructor(props){
        super(props);
        this.getCurrentCounts = this.getCurrentCounts.bind(this);
        this.renderActions = this.renderActions.bind(this);
        this.renderDetailSection = this.renderDetailSection.bind(this);
        this.primaryCount = this.primaryCount.bind(this);
        this.primaryCountLabel = this.primaryCountLabel.bind(this);
    }

    getCurrentCounts(nodes = this.props.path){
        if (nodes.length < 1) return null;
        return ChartDetailCursor.getCounts(nodes[nodes.length - 1]);
    }

    /**
     * Under development.
     *
     * @private
     * @instance
     * @returns {JSX.Element} React DIV element with .row class.
     */
    renderActions(){
        const { sticky, actions } = this.props;
        if (!sticky) return null;
        if (!Array.isArray(actions) || !actions.length === 0) return null;

        const colWidth = 12 / Math.min(4, actions.length);

        const renderedActions = _.map(actions, (action, i, a)=>{
            const title = typeof action.title === 'function' ? action.title(this.props) : action.title;
            const disabled = typeof action.disabled === 'function' ? action.disabled(this.props) : action.disabled;
            const cls = "btn btn-primary btn-sm" + (a.length < 2 ? " btn-block" : "");
            return (
                <div className={"button-container col-" + colWidth} key={title || i}>
                    <button type="button" className={cls} disabled={disabled || false}
                        onClick={action.function.bind(action.function, this.props)}>
                        { title }
                    </button>
                </div>
            );
        });
        return (
            <div className="actions buttons-container">{ renderedActions }</div>
        );
    }

    /**
     * Renders out a row containing 2 counts out of [Exp Sets, Exps, Files], minus whatever is the primary count.
     *
     * @param {Object} props - Props of this component.
     * @returns {JSX.Element} - A DIV React element with a 'row' className.
     */
    renderDetailSection(props = this.props){
        if (props.path.length === 0) return null;
        var currentCounts = this.getCurrentCounts(props.path);
        if (!currentCounts) return null;
        var countsToShow = _.omit(currentCounts, this.props.primaryCount, 'experiments_active');

        countsToShow = _.pairs(countsToShow).map(function(countPair, i){

            var colSize = countPair[0] === 'experiment_sets' ?
                6 : countPair[0] === 'experiments' ?
                    6 : countPair[0] === 'files' ? 4 : 2;
            var name = null;
            if (countPair[0] === 'experiment_sets') name = "Exp Sets";
            if (countPair[0] === 'experiments')     name = "Experiments";
            if (countPair[0] === 'files')           name = "Files";

            return (
                <div key={countPair[0] || i} className={"text-right col-" + colSize}>
                    { countPair[1] }<small> { name }</small>
                </div>
            );
        });

        return (
            <div className="row">
                { this.props.primaryCount !== 'files' ? <div className="col-2"></div> : null }
                { countsToShow }
            </div>
        );
    }

    primaryCount(node){
        return (
            <div className={"primary-count count text-400 pull-right count-" + (this.props.primaryCount || "unknown")}>
                { node[this.props.primaryCount] }
            </div>
        );
    }

    primaryCountLabel(){
        var name = null;
        if (this.props.primaryCount === 'experiment_sets') name = "Exp Sets";
        if (this.props.primaryCount === 'experiments') name = "Experiments";
        if (this.props.primaryCount === 'files') name = "Files";
        return (
            <small className="pull-right sets-label">{ name }</small>
        );
    }

    render(){
        const { path, schemas, includeTitleDescendentPrefix , primaryCount } = this.props;
        if (Array.isArray(path) && path.length === 0){
            return null;
        }
        const leafNode = path[path.length - 1];
        const leafNodeFieldTitle = Schemas.Field.toName(leafNode.field, schemas);

        return (
            <div className="mosaic-cursor-body">
                <Crumbs path={path} schemas={schemas} primaryCount={primaryCount} />
                <h6 className="field-title">
                    { this.primaryCountLabel() }
                    {
                        includeTitleDescendentPrefix && props.path.length > 1 ?
                            <small className="descendent-prefix"> &gt; </small> : null
                    }{ leafNodeFieldTitle }
                    {/* this.props.filteredOut ?
                        <small className="filtered-out-label"> (filtered out)</small>
                    : null */}
                </h6>
                <h3 className="details-title">
                    <i className="term-color-indicator icon icon-circle fas"
                        style={{ color : leafNode.color || barplot_color_cycler.colorForNode(leafNode) }}
                    />
                    { this.primaryCount(leafNode) }
                    <span>{ Schemas.Term.toName(leafNode.field, leafNode.term) }</span>

                </h3>
                <div className="details row">
                    <div className="col-sm-12">
                        { this.renderDetailSection() }
                    </div>
                </div>
                { this.renderActions() }
            </div>
        );
    }
}

const Crumbs = React.memo(function Crumbs({ path, schemas, primaryCount }){
    const offsetPerDescendent = 10;
    const isEmpty = path.length < 2;
    if (isEmpty) return null;
    //var maxSkewOffset = (this.props.path.length - 2) * offsetPerCrumb;

    return (
        <div className={'detail-crumbs' + (isEmpty ? ' no-children' : '')}>
            {
                path.slice(0,-1).map(function(n, i){
                    return (
                        <div
                            data-depth={i}
                            className={"crumb row" + (i===0 ? ' first' : '')}
                            key={i}
                        >
                            <div className="field col-auto" style={ i === 0 ? null : { paddingLeft : 10 + offsetPerDescendent }}>
                                { Schemas.Field.toName(n.field, schemas) }
                            </div>
                            <div className="name col">
                                { n.name || Schemas.Term.toName(n.field, n.term) }
                            </div>
                            <div className="count col-auto pull-right text-right">
                                { n[primaryCount] || n.count }
                            </div>
                        </div>
                    );
                })
            }
        </div>
    );
});


const initialDetailCursorState = {
    'title' : 'Title',
    'term' : 'Title',
    'filteredOut' : false,
    'includeTitleDescendentPrefix' : true,
    'primaryCount' : 'experiment_sets',
    'path' : [
        //{
        //    'field' : "Test.Field.Name",
        //    'term' : "OOH A TERM"
        //}
    ],
    'mounted' : false,
    'sticky' : false,
    'bodyComponent' : Body,
    'actions' : null,
    'xCoordOverride' : null
};


export default class ChartDetailCursor extends React.PureComponent {

    static Body = Body;

    static getCounts(d){
        return {
            'experiments'         : d.experiments || 0,
            'experiments_active'  : d.active || 0,
            'experiment_sets'     : d.experiment_sets || 0,
            'files'               : d.activeFiles || d.files || 0
        };
    }

    static isTargetDetailCursor(elem){
        // Get to top-level element before document.body.
        while (elem.parentElement && elem.parentElement.tagName.toLowerCase() !== 'body'){
            elem = elem.parentElement;
        }
        if (elem && elem.classList && elem.classList.contains('cursor-component-root')) return true;
        return false;
    }

    static defaultProps = {
        'containingElement' : null,
        'hideWhenNoContainingElement' : false,
        // Default/fallback for when no containingElement
        'cursorContainmentDimensions' : {
            offsetLeft : 10,
            offsetTop : 100,
            containingWidth : 300,
            containingHeight : 300
        },
        'width' : 240,
        'height': 80,
        'horizontalAlign' : 'auto',
        'horizontalOffset' : 25,
        'verticalAlign' : 'top',
        'verticalOffset' : 10,
        'debugStyle' : false
    };

    constructor(props){
        super(props);
        this.getCursorOffset = this.getCursorOffset.bind(this);
        this.update = this.update.bind(this);
        this.reset = this.reset.bind(this);
        this.getState = this.getState.bind(this);
        this.setCoords = this.setCoords.bind(this);
        this.state = _.clone(initialDetailCursorState);

        this.cursorComponentRef = React.createRef();
    }

    componentDidMount(){
        console.log('Mounted MouseDetailCursor');
        this.setState({ 'mounted' : true });
    }

    getCursorOffset(){
        var cursorOffset = { x : 0, y : 0 };

        if (this.props.horizontalAlign !== 'center'){
            cursorOffset.x = (this.props.width / 2 + this.props.horizontalOffset);
            if (this.props.horizontalAlign === 'right'){
                cursorOffset.x = -cursorOffset.x;
            }
        }
        if (this.props.verticalAlign !== 'center'){
            cursorOffset.y = (this.props.height / 2 + this.props.verticalOffset);
            if (this.props.verticalAlign === 'bottom'){
                cursorOffset.y = -cursorOffset.y;
            }
        }
        return cursorOffset;
    }

    /**
     * Call this function to update component state with the new "path" and other properties, if applicable.
     *
     * @public
     * @param {Object} state - New state to set. Should contain a 'path' property.
     * @param {function} [cb] - Optional callback function. Takes updated state as argument.
     * @param {boolean} [overrideSticky=true] - If false, will cancel out if stickied.
     * @returns {void} Nothing
     */
    update(state = {}, cb = null, overrideSticky = false){
        if (overrideSticky) this.overrideSticky = true; // Unset this on subsequent update.
        if (state.field) state.field = Schemas.Field.toName(state.field, this.props.schemas);
        else if (Array.isArray(state.path) && state.path.length > 0 && state.path[state.path.length - 1].field){
            state.field = Schemas.Field.toName(state.path[state.path.length - 1].field, this.props.schemas);
        }
        if (this.props.debugStyle && state.path && state.path.length === 0) return null;
        return this.setState(state, cb);
    }

    /**
     * Call this function to reset component state. Cancels out if stickied.
     *
     * @public
     * @param {boolean} [overrideSticky=true] - If false, will cancel out if stickied.
     * @param {function} [cb] - Optional callback function. Takes updated state as argument.
     * @returns {boolean} True if reset, false if not.
     */
    reset(overrideSticky = true, cb = null){
        if (this.state.sticky && !overrideSticky) {
            // Cancel out
            return false;
        }
        this.setState(_.omit(initialDetailCursorState, 'mounted'), cb);
        return true;
    }

    getState(){
        return _.clone(this.state);
    }

    setCoords(coords, cb){
        var cursorInstance = this.cursorComponentRef.current;
        if (!cursorInstance) {
            logger.error("Cursor component not available.");
            return false;
        }
        cursorInstance.setState(coords, cb);
    }

    render(){
        const { containingElement, hideWhenNoContainingElement, cursorContainmentDimensions, windowWidth, windowHeight, visibilityMargin } = this.props;
        const { sticky, path, xCoordOverride, mounted, bodyComponent } = this.state;
        let containDims = {};

        if (!containingElement){
            if (hideWhenNoContainingElement) return null;
            containDims = cursorContainmentDimensions;
            if (mounted && !isServerSide()){
                containDims = {
                    'containingWidth'   : windowWidth,
                    'containingHeight'  : windowHeight,
                    'offsetTop'         : 80,
                    'offsetLeft'        : 0
                };
            }
        }

        const isVisible = sticky || (Array.isArray(path) && path.length > 0);

        //if (!isVisible) return null;
        return (
            <CursorComponent {...containDims}
                {..._.pick(this.props, 'width', 'height', 'horizontalAlign', 'debugStyle')}
                containingElement={containingElement} cursorOffset={this.getCursorOffset()}
                xCoordOverride={xCoordOverride} className="mosaic-detail-cursor"
                isVisible={isVisible} visibilityMargin={visibilityMargin || {
                    left: 0,
                    right: 0,
                    bottom: -50,
                    top: -10
                }}
                ref={this.cursorComponentRef} sticky={sticky}>
                { React.createElement(
                    bodyComponent,
                    _.extend(
                        _.omit(this.props, 'children'),
                        this.state
                    )
                ) }
            </CursorComponent>
        );
    }

}
