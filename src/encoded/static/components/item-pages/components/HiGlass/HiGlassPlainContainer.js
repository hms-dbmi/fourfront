//'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import { console, object, ajax, isServerSide, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { requestAnimationFrame } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import { PackageLockLoader } from './../../../util/package-lock-loader';


/**
 * Helper function to test if an Item is a HiglassViewConfig Item.
 * To be used by Components such as BasicStaticSectionBody to determine
 * what time of view to render.
 */
export function isHiglassViewConfigItem(context){
    if (!context) return false;
    if (Array.isArray(context['@type'])){
        // Ideal case is that @type is present. However it may not be embedded in all cases.
        return context['@type'].indexOf('HiglassViewConfig') > -1;
    }
    // Fallback test in case @type is not present;
    const itemAtId = object.itemUtil.atId(context);
    if (!itemAtId || itemAtId[0] !== '/') return false;
    const pathPartForType = itemAtId.slice(1).split('/', 1)[0];
    return pathPartForType === 'higlass-view-configs';
}


/**
 * Functional component to display loading indicator.
 *
 * @param {{ icon: string, title: JSX.Element|string }} props Props passed into this Component.
 */
export function HiGlassLoadingIndicator(props) {
    const { icon, title } = props;
    return (
        <React.Fragment>
            <h3>
                <i className={"icon icon-lg icon-" + (icon || "tv fas")}/>
            </h3>
            { title || "Initializing" }
        </React.Fragment>
    );
}

let higlassDependencies = null;

// /** Loaded upon componentDidMount; HiGlassComponent is not supported server-side. */
// let HiGlassComponent = null;
// let higlassRegister = null;

export class HiGlassPlainContainer extends React.PureComponent {

    static correctTrackDimensions(hiGlassComponent){
        requestAnimationFrame(()=>{
            _.forEach(hiGlassComponent.tiledPlots, (tp) => tp && tp.measureSize());
        });
    }

    static propTypes = {
        'viewConfig' : PropTypes.object.isRequired,
        'isValidating' : PropTypes.bool,
        'height' : PropTypes.number,
        'mountDelay' : PropTypes.number.isRequired,
        'onViewConfigUpdated': PropTypes.func,
        'scale1dTopTrack': PropTypes.bool.isRequired,
    };

    static defaultProps = {
        'options' : { 'bounded' : true },
        'isValidating' : false,
        'disabled' : false,
        'height' : 500,
        'viewConfig' : null,
        'mountDelay' : 500,
        'placeholder' : <HiGlassLoadingIndicator/>,
        'scale1dTopTrack': false
    };

    constructor(props){
        super(props);
        this.correctTrackDimensions = this.correctTrackDimensions.bind(this);
        this.getHiGlassComponent = this.getHiGlassComponent.bind(this);
        this.memoized = {
            scaleHiGlassViewConfig: memoize(scaleHiGlassViewConfig)
        };

        this.state = {
            'mounted' : false,
            'mountCount' : 0,
            'hasRuntimeError' : false,
            'higlassInitialized' : false
        };

        this.hgcRef = React.createRef();
    }

    componentDidMount(){
        const { mountDelay, onViewConfigUpdated } = this.props;
        const finish = () => {
            this.setState(function(currState){
                return {
                    'mounted' : true,
                    'mountCount' : currState.mountCount + 1
                };
            }, () => {

                setTimeout(()=>{
                    this.setState({ "higlassInitialized": true }, ()=>{
                        setTimeout(this.correctTrackDimensions, 500);
                        if (onViewConfigUpdated && typeof onViewConfigUpdated === 'function') {
                            const hgc = this.getHiGlassComponent();
                            if (hgc) {
                                hgc.api.on("viewConfig", onViewConfigUpdated);
                            }
                        }
                    });
                }, 500);

            });
        };

        setTimeout(()=>{ // Allow tab CSS transition to finish (the render afterwards lags browser a little bit).

            if (!higlassDependencies) {
                window.fetch = window.fetch || ajax.fetchPolyfill; // Browser compatibility polyfill

                // Load in HiGlass libraries as separate JS file due to large size.
                import(
                    /* webpackChunkName: "higlass-dependencies" */
                    'higlass-dependencies'
                ).then((loadedDeps) =>{
                    higlassDependencies = loadedDeps;
                    const { higlassRegister, StackedBarTrack } = higlassDependencies;

                    higlassRegister({
                        name: 'StackedBarTrack',
                        track: StackedBarTrack,
                        config: StackedBarTrack.config,
                    });
                    finish();
                });

            } else {
                finish();
            }

        }, mountDelay || 500);

    }

    correctTrackDimensions(){
        var hgc = this.getHiGlassComponent();
        if (hgc){
            HiGlassPlainContainer.correctTrackDimensions(hgc);
        } else {
            logger.error('NO HGC');
        }
    }

    componentWillUnmount(){
        this.setState({ 'mounted' : false });
    }

    componentDidCatch(){
        this.setState({ 'hasRuntimeError' : true });
    }

    getHiGlassComponent(){
        return (this && this.hgcRef && this.hgcRef.current) || null;
    }

    render(){
        const { viewConfig: originalViewConfig, height, scale1dTopTrack, ...passProps } = this.props;
        const viewConfig = scale1dTopTrack ? this.memoized.scaleHiGlassViewConfig(originalViewConfig, height) : originalViewConfig;
        return (
            <PackageLockLoader>
                <HiGlassPlainContainerBody {...passProps} {...{ viewConfig, height }} {...this.state} ref={this.hgcRef} />
            </PackageLockLoader>
        );
    }
}

/**
 * Dynamically scale the 1-dimensional top tracks in the Higlass viewconf.
 * @param {*} originalViewConf Higlass view configuration. This is not modified.
 * @param {*} targetHeight target height for the Higlass config, in pixels.
 * @returns new viewConfig scaled to target height
 */
export function scaleHiGlassViewConfig(originalViewConf, targetHeight){
    const viewConf = object.deepClone(originalViewConf);

    // Check parameters.
    if (!("views" in viewConf)) { return viewConf; }
    if (targetHeight === null || targetHeight <= 0) { return viewConf; }

    // Are there any views with 1D tracks? If not, stop
    const has1DTracks = function(view) {
        return (
            "tracks" in view &&
            "top" in view["tracks"] &&
            view["tracks"]["top"].length > 0
        );
    };
    if (!(_.some(viewConf["views"], has1DTracks))) {
        return viewConf;
    }

    // Determine the height for each view. There may be so many views they must be on multiple rows.
    const heightPerView = viewConf["views"] <= 2 ? targetHeight : (targetHeight / 2) | 0;

    _.each(viewConf["views"], function(view){
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

        const tracksEligibleForScaling = _.filter(view["tracks"]["top"], function(track) {
            // Don't scale gene annotation tracks, they need to be completely visible
            return (("height" in track) && track["type"] !== "horizontal-gene-annotations");
        });

        if (tracksEligibleForScaling.length === 0) { return; }

        const sumOfOriginal1DTracks = _.reduce(
            tracksEligibleForScaling,
            function(memo, track) { return memo + track["height"];},
            0
        );
        // Resize each 1D track to fit the given display height (round to the nearest integer so Higlass can use them)
        _.each(
            tracksEligibleForScaling,
            function (track) {
                track["height"] = (track["height"] * scaledHeightFor1DTracks / sumOfOriginal1DTracks) | 0;
            }
        );
    });
    return viewConf;
}


const HiGlassPlainContainerBody = React.forwardRef(function HiGlassPlainContainerBody(props, ref){
    const { viewConfig, options, hasRuntimeError, disabled, isValidating, mounted, higlassInitialized, width, height, mountCount, placeholder, style, className, packageLockJson } = props;
    const outerKey = "mount-number-" + mountCount;
    const { dependencies: { higlass : { version: higlassVersionUsed = null } = {} } = {} } = packageLockJson || {};
    const { HiGlassComponent } = higlassDependencies || {};

    let hiGlassInstance = null;
    if (isValidating || !mounted){
        const placeholderStyle = { width: width || null };
        if (typeof height === 'number' && height >= 140){
            placeholderStyle.height = height;
            placeholderStyle.paddingTop = (height / 2) - 40;
        }
        hiGlassInstance = <div className="text-center" style={placeholderStyle} key={outerKey}>{ placeholder }</div>;
    } else if (disabled) {
        hiGlassInstance = (
            <div className="text-center" key={outerKey} style={placeholderStyle}>
                <h4 className="text-400">Not Available</h4>
            </div>
        );
    } else if (hasRuntimeError) {
        hiGlassInstance = (
            <div className="text-center" key={outerKey} style={placeholderStyle}>
                <h4 className="text-400">Runtime Error</h4>
            </div>
        );
    } else {
        /**
         * Fade in div element containing HiGlassComponent after HiGlass initiates & loads in first tile etc. (about 500ms).
         * For prettiness only.
         */
        const instanceContainerRefFunction = function(element){
            if (!element) return;
            setTimeout(function(){
                requestAnimationFrame(function(){
                    element.style.transition = null; // Use transition as defined in stylesheet
                    element.style.opacity = 1;
                });
            }, 500);
        };
        hiGlassInstance = (
            <div key={outerKey} className="higlass-instance" style={{ 'transition' : 'none', 'height' : height, 'width' : width || null }} ref={instanceContainerRefFunction}>
                <HiGlassComponent {...{ options, viewConfig, width, height, ref }} />
            </div>
        );
    }


    /**
     * TODO: Some state + UI functions to make higlass view full screen.
     * Should try to make as common as possible between one for workflow tab & this. Won't be 100% compatible since adjust workflow detail tab inner elem styles, but maybe some common func for at least width, height, etc.
     */
    return (
        <div className={"higlass-view-container" + (className ? ' ' + className : '')} style={style}>
            { higlassVersionUsed === null ? null : <link type="text/css" rel="stylesheet" href={`https://unpkg.com/higlass@${higlassVersionUsed}/dist/hglib.css`} crossOrigin="true" /> }
            <div className="higlass-wrapper">{ hiGlassInstance }</div>
        </div>
    );

});
