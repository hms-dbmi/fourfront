'use strict';

import React from 'react';
import _ from 'underscore';
import { ajax, object } from './../../../util';
import { HiGlassPlainContainer, HiGlassLoadingIndicator } from './HiGlassPlainContainer';
import memoize from 'memoize-one';
import { deepClone } from "../../../util/object";

/**
 * Accepts `higlassItem` (HiglassViewConfig Item JSON) as a prop and loads in the full
 * representation from `higlassItem.@id` if `higlassItem.viewconfig` is not present before
 * instantiating a HiGlassPlainContainer.
 */
export class HiGlassAjaxLoadContainer extends React.PureComponent {

    /**
     * Dynamically scale the 1-dimensional top tracks in the Higlass viewconf.
     * Memoized function.
     * @param {object} The Higlass view configuration. This is not modified.
     * @param {integer} The target height for the Higlass config, in pixels.
     * @returns {object}
     */
    static scaleViewconfToHeight = memoize(function(originalViewconf, givenHeight){
        var viewconf = deepClone(originalViewconf);

        // Check parameters.
        if (!("views" in viewconf)) { return viewconf; }
        if (givenHeight === null || givenHeight <= 0) {return viewconf; }

        // Are there any views with 1D tracks? If not, stop
        const has1DTracks = function(view) {
            return (
                "tracks" in view &&
                "top" in view["tracks"] &&
                view["tracks"]["top"].length > 0
            );
        };
        if (!(_.some(viewconf["views"], has1DTracks))) {
            return viewconf;
        }

        // Determine the height for each view. There may be so many views they must be on multiple rows.
        const heightPerView = viewconf["views"] <= 2 ? givenHeight : (givenHeight / 2) | 0;

        _.each(viewconf["views"], function(view){
            if (!(has1DTracks(view))) { return; }

            // 2D tracks scale automatically, so we will let it take about 2/3s of the total height.
            let scaledHeightFor1DTracks = heightPerView;
            if (
                "tracks" in view &&
                "center" in view["tracks"] &&
                view["tracks"]["center"].length > 0
            ) {
                scaledHeightFor1DTracks = (heightPerView / 3) | 0;
            }

            const sumOfOriginal1DTracks = _.reduce(
                _.filter(view["tracks"]["top"], function(track) { return ("height" in track);}),
                function(memo, track) { return memo + track["height"];},
                0
            );
            // Resize each 1D track to fit the given display height (round to the nearest integer so Higlass can use them)
            _.each(
                _.filter(view["tracks"]["top"], function(track) { return ("height" in track);}),
                function (track) {
                    track["height"] = (track["height"] * scaledHeightFor1DTracks / sumOfOriginal1DTracks) | 0;
                }
            );
        });
        return viewconf;
    });

    constructor(props){
        super(props);
        this.getFullHiglassItem = this.getFullHiglassItem.bind(this);
        this.state = {
            'loading': false,
            'higlassItem' : (props.higlassItem && props.higlassItem.viewconfig) ? props.higlassItem : null
        };
        this.containerRef = React.createRef();
    }

    componentDidMount(){
        if (!this.state.higlassItem) {
            this.getFullHiglassItem();
        }
    }

    componentDidUpdate(pastProps){
        // After updating the component, load the new higlass component if it changed.
        if (pastProps.higlassItem !== this.props.higlassItem){
            if (this.props.higlassItem.viewconfig){
                this.setState({ 'higlassItem' : this.props.higlassItem });
            } else {
                this.getFullHiglassItem();
            }
        }
    }

    /**
     * Retrieve the HiGlass Component, if it exists.
     *
     * @returns {object} The result of getHiGlassComponent on the HiGlass container. Or null if it doesn't exist.
     */
    getHiGlassComponent(){
        return (this.containerRef && this.containerRef.current && this.containerRef.current.getHiGlassComponent()) || null;
    }

    /**
    * Makes an AJAX call to get the Higlass viewconfig resource.
    */
    getFullHiglassItem(){
        var { higlassItem } = this.props;
        // Use the @id to make an AJAX request to get the HiGlass Item.
        this.setState({ 'loading': true }, ()=>{
            // Use the @id to get the item, then remove the loading message
            ajax.load(object.itemUtil.atId(higlassItem), (r)=>{
                this.setState({ 'higlassItem' : r,'loading': false });
            });
        });
        static defaultProps = {
            height : HiGlassPlainContainer.defaultProps.height
        };
    }
    render(){
        var { higlassItem, loading } = this.state;
        var { height } = this.props;

        // Use the height to make placeholder message when loading.
        var placeholderStyle = { "height" : height || 600 };
        if (placeholderStyle.height >= 140) {
            placeholderStyle.paddingTop = (placeholderStyle.height / 2) - 40;
        }

        // If we're loading, show a loading screen
        if (loading){
            return <div className="text-center" style={placeholderStyle}><HiGlassLoadingIndicator title="Loading" /></div>;
        }

        // Raise an error if there is no viewconfig
        if (!higlassItem || !higlassItem.viewconfig) {
            return (
                <div className="text-center" style={placeholderStyle}>
                    <HiGlassLoadingIndicator icon="exclamation-triangle" title="No HiGlass content found. Please go back or try again later." />
                </div>
            );
        }

        // Scale the higlass config so it fits the given container.
        const adjustedViewconfig = HiGlassAjaxLoadContainer.scaleViewconfToHeight(higlassItem.viewconfig, height);
        // Pass the viewconfig to the HiGlassPlainContainer
        return <HiGlassPlainContainer {..._.omit(this.props, 'higlassItem')} viewConfig={adjustedViewconfig} ref={this.containerRef}/>;
    }
}
