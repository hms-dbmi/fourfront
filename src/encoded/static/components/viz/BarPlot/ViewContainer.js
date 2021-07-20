'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import * as vizUtil from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import { console, isServerSide, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { barplot_color_cycler } from './../ColorCycler';
import { CursorViewBounds } from './../ChartDetailCursor';



/**
 * Outputs a section of a bar.
 *
 * @class BarSection
 * @type {Component}
 */
class BarSection extends React.PureComponent {

    constructor(props){
        super(props);
        _.bindAll(this, 'mouseEnter', 'mouseLeave', 'click');
        this.barSectionElemRef = React.createRef();
    }

    /**
     * Call the `onMouseLeave` prop callback fxn in preparation
     * to dismount in order to clean up if necessary.
     *
     * @todo Maybe check for `props.isHoveredOver` first?
     */
    componentWillUnmount(){
        var { isSelected, isHoveredOver, onMouseLeave, node } = this.props;
        if (this.barSectionElemRef.current && (isSelected || isHoveredOver)){
            onMouseLeave(node, { 'relatedTarget' : this.barSectionElemRef.current });
        }
    }

    mouseEnter(e){
        const { onMouseEnter, node } = this.props;
        return onMouseEnter && onMouseEnter(node, e);
    }

    mouseLeave(e){
        const { onMouseLeave, node } = this.props;
        return onMouseLeave && onMouseLeave(node, e);
    }

    click(e){
        const { onClick, node } = this.props;
        return onClick && onClick(node, e);
    }

    /**
     * @returns {Element} - A div element representing a bar section.
     */
    render(){
        const { node: d, isSelected, isHoveredOver, canBeHighlighted } = this.props;
        const color           = d.color || barplot_color_cycler.colorForNode(d);
        let className = "bar-part";

        if (d.parent)           className += ' multiple-parts';
        if (isSelected)         className += ' selected';
        if (isHoveredOver)      className += ' hover';
        if (!canBeHighlighted)  className += ' no-highlight';
        else                    className += ' no-highlight-color';

        var height;
        if (!d.parent) { // No sub-buckets
            height = '100%';
        } else {
            // Use a percentage for styling purposes because we want the outermost bar height
            // to transition and child bar sections to stay aligned to it.
            height = (d.count / d.parent.count) * 100 + '%';
        }

        return (
            <div className={className} ref={this.barSectionElemRef}
                style={{
                    height, 'backgroundColor' : color
                    //width: '100%', //(this.props.isNew && d.pastWidth) || (d.parent || d).attr.width,
                }}
                data-key={this.props['data-key'] || null} data-term={d.parent ? d.term : null}
                data-count={d.count} data-color={color} data-target-height={d.attr.height}
                key={'bar-part-' + (d.parent ? d.parent.term + '~' + d.term : d.term)}
                onMouseEnter={this.mouseEnter} onMouseLeave={this.mouseLeave} onClick={this.click}
            />
        );
    }
}


/**
 * Outputs a vertical bar containing bar sections.
 *
 * @class Bar
 * @type {Component}
 */
class Bar extends React.PureComponent {

    constructor(props){
        super(props);
        this.verifyCounts = this.verifyCounts.bind(this);
        this.barStyle = this.barStyle.bind(this);
        this.renderBarSection = this.renderBarSection.bind(this);
        this.state = {
            'mounted' : false
        };
        this.barElemRef = React.createRef();
    }

    componentDidMount(){
        this.verifyCounts();
    }

    componentDidUpdate(pastProps){
        if (this.props.node !== pastProps.node){
            this.verifyCounts();
        }
    }

    /**
     * Double check sum of bar parts and report an Exception to Google Analytics if doesn't match.
     * Do this in a setTimeout because it doesn't affect rendering or site UI.
     */
    verifyCounts(){
        var d = this.props.node;
        if (!d.bars) return;
        setTimeout(()=>{
            var combinedChildrenCount = _.reduce(d.bars, function(sum, bar){
                return sum + bar.count;
            }, 0);
            if (combinedChildrenCount && d.count !== combinedChildrenCount){
                var errorMsg = (
                    "Data Error: 1 or more ExperimentSets was counted multiple times for 'group by' field '" +
                    d.bars[0].field + "'."
                );
                logger.error(errorMsg);
            }
        }, 0);
    }

    barStyle(){
        const { node, styleOptions } = this.props;
        const style = {};

        // Position bar's x coord via translate3d CSS property for CSS3 transitioning.
        style.transform = vizUtil.style.translate3d(node.attr.x, 0, 0);
        style.left = styleOptions.offset.left;
        style.bottom = styleOptions.offset.bottom;
        style.width = node.attr.width;
        style.height = node.attr.height;

        return style;
    }

    renderBarSection(d, i, all){
        var { hoverTerm, hoverParentTerm, selectedTerm, selectedParentTerm, onBarPartClick,
                onBarPartMouseEnter, onBarPartMouseOver, onBarPartMouseLeave,
                aggregateType, canBeHighlighted } = this.props,
            key = d.term || d.name || i,
            isHoveredOver   = CursorViewBounds.isSelected(d, hoverTerm, hoverParentTerm),
            isSelected      = CursorViewBounds.isSelected(d, selectedTerm, selectedParentTerm);

        return (
            <BarSection {...{ isHoveredOver, isSelected, key, aggregateType, canBeHighlighted }} data-key={key} node={d}
                onClick={onBarPartClick} onMouseEnter={onBarPartMouseEnter} onMouseLeave={onBarPartMouseLeave} isRemoving={d.removing} />
        );
    }

    render(){
        const { canBeHighlighted, showBarCount, node: d } = this.props;
        const hasSubSections = Array.isArray(d.bars);
        const barSections = (hasSubSections ?
            // If needed, remove sort + reverse to keep order of heaviest->lightest aggs regardless of color
            barplot_color_cycler.sortObjectsByColorPalette(d.bars).reverse() : [_.extend({}, d, { color : 'rgb(139, 114, 142)' })]
        );
        let className = "chart-bar";
        const topLabel = showBarCount ? <span className="bar-top-label" key="text-label">{ d.count }</span> : null;

        if (!canBeHighlighted)  className += ' no-highlight';
        else                    className += ' no-highlight-color';

        return (
            <div
                className={className}
                data-term={d.term}
                data-count={d.count}
                data-field={Array.isArray(d.bars) && d.bars.length > 0 ? d.bars[0].field : null}
                key={"bar-" + d.term}
                style={this.barStyle()}
                ref={this.barElemRef}>
                { topLabel }
                { _.map(barSections, this.renderBarSection) }
            </div>
        );
    }
}

/**
 * React Component for wrapping the generated markup of BarPlot.Chart.
 * Also contains Components Bar and BarSection as static children, for wrapping output bar and bar parts.
 *
 * The top-level ViewContainer component contains state for interactivity of the generated chart mark-up.
 * The child Bar and BarSection components are stateless and utilize the state passed down from ViewContainer.
 */
export class ViewContainer extends React.Component {

    static Bar = Bar
    static BarSection = BarSection

    static defaultProps = {
        'canBeHighlighted' : true
    };

    constructor(props){
        super(props);
        this.verifyCounts = this.verifyCounts.bind(this);
        this.renderBars = this.renderBars.bind(this);
    }

    componentDidMount(){
        this.verifyCounts();
    }

    componentDidUpdate(pastProps){
        if (this.props.bars !== pastProps.bars || this.props.aggregateType !== pastProps.aggregateType || this.props.topLevelField !== pastProps.topLevelField){
            this.verifyCounts();
        }
    }

    /**
     * Double check sum of bar parts and report an Exception to Google Analytics if doesn't match.
     * Do this in a setTimeout because it doesn't affect rendering or site UI.
     */
    verifyCounts(){
        var { bars, topLevelField, aggregateType } = this.props,
            totalCount = topLevelField && topLevelField.total && topLevelField.total[aggregateType];

        if (!totalCount || !bars) return;

        setTimeout(()=>{
            var combinedChildrenCount = _.reduce(bars, function(sum, bar){
                return sum + bar.count;
            }, 0);
            if (combinedChildrenCount && totalCount !== combinedChildrenCount){
                var errorMsg = (
                    "Data Error: 1 or more ExperimentSets was counted multiple times for 'group by' field '" +
                    bars[0].field + "'."
                );
                logger.error(errorMsg);
            }
        }, 0);
    }

    /**
     * Passes props to and renders child 'Bar' Components.
     * Passes in own state, high-level props if child prop not set, and extends event handlers.
     *
     * @returns {Component[]} Array of 'Bar' React Components.
     */
    renderBars(){
        var { bars, onNodeMouseEnter, onNodeMouseLeave, onNodeClick } = this.props,
            barsToRender, currentBars;

        return _.map(bars.sort(function(a,b){ // key will be term or name, if available
            return (a.term || a.name) < (b.term || b.name) ? -1 : 1;
        }), (d,i,a) =>
            <CSSTransition classNames="barplot-transition" unmountOnExit timeout={{ enter: 10, exit: 750 }} key={d.term || d.name || i}>
                <Bar key={d.term || d.name || i} node={d}
                    showBarCount={true /*!allExpsBarDataContainer */}
                    {..._.pick(this.props, 'selectedParentTerm', 'selectedTerm', 'hoverParentTerm', 'hoverTerm', 'styleOptions',
                        'aggregateType', 'showType', 'canBeHighlighted')}
                    onBarPartMouseEnter={onNodeMouseEnter} onBarPartMouseLeave={onNodeMouseLeave} onBarPartClick={onNodeClick} />
            </CSSTransition>
        );
    }

    render(){
        var { topLevelField, width, height, bars } = this.props,
            anyHiddenOtherTerms = topLevelField.other_doc_count || _.any(_.values(topLevelField.terms), function(tV){
                return tV.other_doc_count;
            });
        return (
            <div className="bar-plot-chart chart-container no-highlight"
                data-field={topLevelField.field} style={{ height, width }}
                /*
                onMouseLeave={(evt)=>{
                    if (ChartDetailCursor.isTargetDetailCursor(evt.relatedTarget)){
                        return false;
                    }
                    var newState = {};
                    if (this.state.hoverBarSectionTerm) {
                        newState.hoverBarSectionParentTerm = newState.hoverBarSectionTerm = null;
                    }
                    if (this.state.selectedBarSectionTerm) {
                        newState.selectedBarSectionParentTerm = newState.selectedBarSectionTerm = null;
                    }
                    if (_.keys(newState).length > 0){
                        this.setState(newState);
                    }
                }}
                */
            >
                { anyHiddenOtherTerms ?
                    <div className="terms-excluded-notice text-smaller">
                        <p className="mb-0">* Only up to the top 30 terms are shown.</p>
                    </div>
                    : null }
                { this.props.leftAxis }
                {/* allExpsBarDataContainer && allExpsBarDataContainer.component */}
                <TransitionGroup>{ this.renderBars() }</TransitionGroup>
                { this.props.bottomAxis }
            </div>
        );

    }

}


/**
 * Wraps ViewContainer with PopoverViewBounds, which feeds it
 * props.onNodeMouseEnter(node, evt), props.onNodeMouseLeave(node, evt), props.onNodeClick(node, evt),
 * props.selectedTerm, props.selectedParentTerm, props.hoverTerm, and props.hoverParentTerm.
 *
 * @export
 * @class PopoverViewContainer
 * @extends {React.Component}
 */
export class PopoverViewContainer extends React.PureComponent {

    static propTypes = {
        'height' : PropTypes.number,
        'width'  : PropTypes.number,
        'cursorDetailActions': PropTypes.arrayOf(PropTypes.shape({
            'title' : PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,
            'function' : PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,
            'disabled' : PropTypes.oneOfType([PropTypes.bool, PropTypes.func]).isRequired,
        }))
    };

    static defaultProps = {
        'cursorContainerMargin' : 100
    };

    constructor(props){
        super(props);
        this.getCoordsCallback = this.getCoordsCallback.bind(this);
    }

    getCoordsCallback(node, containerPosition, boundsHeight){
        var bottomOffset = (this.props && this.props.styleOptions && this.props.styleOptions.offset && this.props.styleOptions.offset.bottom) || 0;
        var leftOffset = (this.props && this.props.styleOptions && this.props.styleOptions.offset && this.props.styleOptions.offset.left) || 0;

        var barYPos = node.attr.height;

        if (node.parent){
            var done = false;
            barYPos = _.reduce(
                node.parent.bars,//.slice(0).reverse(),
                //_.sortBy(node.parent.bars, 'term').reverse(),
                function(m, siblingNode){
                    if (done) return m;
                    if (siblingNode.term === node.term){
                        done = true;
                    }
                    return m + siblingNode.attr.height;
                },
                0
            );
        }

        return {
            'x' : containerPosition.left + leftOffset + (node.parent || node).attr.x + ((node.parent || node).attr.width / 2),
            'y' : containerPosition.top + boundsHeight - bottomOffset - barYPos,
        };
    }

    render(){
        return (
            <CursorViewBounds {..._.pick(this.props, 'height', 'width', 'cursorContainerMargin', 'actions', 'href', 'context', 'schemas')}
                eventCategory="BarPlot" // For Analytics events
                highlightTerm={false} clickCoordsFxn={this.getCoordsCallback}>
                <ViewContainer {...this.props} />
            </CursorViewBounds>
        );
    }
}
