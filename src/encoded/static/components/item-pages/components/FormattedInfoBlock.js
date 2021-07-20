'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { ajax, console, isServerSide, object, analytics, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';
import { generateAddressString, ContactPersonListItem } from './AttributionTabView';



// TODO: CLEANUP FILE

/**
 * Wraps some React elements, such as a list or title, in a FormattedInfoBlock-styled wrapper.
 *
 * @prop {boolean} isSingleItem     - Whether there is only 1 item or not.
 * @prop {Element[]} children       - React Elements or Components to be wrapped.
 * @prop {string} [singularTitle]   - Optional. Title displayed in top left label. Defaults to 'Publication'.
 * @prop {string} [className]       - Additional className to be added to wrapper element.
 * @prop {string} [iconClass='book']- CSS class for icon to be displayed. Defaults to 'book'.
 */
export const FormattedInfoWrapper =  React.memo(function FormattedInfoWrapper(props){
    const { isSingleItem, className, singularTitle, iconClass, children, noDetails } = props;
    const outerClassName = (
        "publications-block formatted-info-panel formatted-wrapper" +
        (isSingleItem ? ' single-item' : '') +
        (className ? ' ' + className : '')
    );
    return (
        <div className={outerClassName}>
            <h6 className="publication-label">{ singularTitle }{ isSingleItem ? '' : 's' }</h6>
            <div className="row">
                <div className="icon-container col-2 col-lg-1 px-0">
                    <i className={"icon icon-" + iconClass} />
                </div>
                <div className={"col-10 col-lg-11" + (isSingleItem && noDetails ? ' no-more-details' : '')}>{ children }</div>
            </div>
        </div>
    );
});
FormattedInfoWrapper.defaultProps = {
    'isSingleItem'  : false,
    'singularTitle' : 'Publication',
    'iconClass'     : 'book fas',
    'className'     : null,
    'noDetails'     : false
};


export const WrappedListBlock = React.memo(function WrappedListBlock(props){
    const { context, className } = props;
    const atId = object.itemUtil.atId(context);
    return (
        <li className={className} key={atId}>
            <a className="text-500" href={atId}>{ context.display_title || context.title }</a>
        </li>
    );
});


export class WrappedCollapsibleList extends React.Component {

    static defaultProps = {
        'persistentCount'   : 3,
        'publications'      : [],
        'singularTitle'     : 'Publication',
        'itemClassName'     : null,
        'iconClass'         : 'book fas',
        'itemRenderFxn'     : null,
        'wrapperElement'    : 'ul'
    };

    constructor(props){
        super(props);
        this.itemRenderFxnFallback = this.itemRenderFxnFallback.bind(this);
        this.onToggle = this.onToggle.bind(this);
        this.renderItems = this.renderItems.bind(this);
        this.state = {
            'open' : false
        };
    }

    itemRenderFxnFallback(item, idx, all){
        return <WrappedListBlock className={this.props.itemClassName} context={item} key={object.itemUtil.atId(item) || idx} />;
    }

    onToggle(){
        this.setState(function({ open }){
            return { 'open' : !open };
        });
    }

    renderItems(){
        const { itemClassName, persistentCount, items, itemRenderFxn, wrapperElement } = this.props;
        const { open } = this.state;
        const itemsToElements = (pubs) => _.map(pubs, itemRenderFxn || this.itemRenderFxnFallback);

        if (items.length <= persistentCount){
            return React.createElement(wrapperElement || 'ul', {}, itemsToElements(items));
        } else {
            // Only show first 3 (props.persistentCount), then a 'more' button.
            return (
                <PartialList containerType={wrapperElement} open={open}
                    persistent={itemsToElements(items.slice(0, persistentCount))}
                    collapsible={itemsToElements(items.slice(persistentCount)) } />
            );
        }
    }

    render(){
        const { items, iconClass, singularTitle, persistentCount } = this.props;
        const { open } = this.state;
        // publications = testData; // Uncomment to test listview.

        if (!Array.isArray(items) || items.length < 1) return null;

        const isSingleItem = items.length === 1;

        return (
            <FormattedInfoWrapper isSingleItem={isSingleItem} singularTitle={singularTitle} iconClass={iconClass}>
                <div>
                    { this.renderItems() }
                    { items.length > persistentCount ?
                        <button type="button" className="btn btn-outline-dark btn-sm" onClick={this.onToggle}>
                            { open ? "Collapse" : "See " + (items.length - persistentCount) + " More" }
                        </button>
                        : null }
                </div>
            </FormattedInfoWrapper>
        );
    }

}


/**
 * Optional container of FormattedInfoBlocks, wrapping them in a <UL> and <LI> elements.
 * Encapsulates all required ajax/aggregation for fetching array of fields/data.
 * Available via FormattedInfoBlock.List
 *
 * @prop {Object[]} details         - Array of complete details to display.
 * @prop {string[]} endpoints       - Array of endpoints to AJAX details from.
 * @prop {function} renderItem      - Render function for items. Should return a FormattedInfoBlock component.
 * @prop {Component|Element|string} fallbackMsg - What to display if both details and endpoints don't exist or are empty.
 * @prop {string} [propertyName]    - Descriptive unique ID of property/ies displayed.
 * @prop {function} [ajaxCallback]  - Callback to execute with details, if/after they are fetched w/ AJAX.
 */
class FormattedInfoBlockList extends React.Component {

    /**
     * Same functionality as @see FormattedInfoBlock.ajaxPropertyDetails, catered to a list.
     * Use (FormattedInfoBlock.List.ajaxPropertyDetails.)bind/call/apply and from another (e.g. parent) React component.
     *
     * @param {string[]} endpoints - Array of endpoints to get data from.
     * @param {string} propertyName - A unique id to use as state property suffix for saving results, e.g. 'labs' for state.details_labs.
     * @param {function} [callback] - Optional callback, takes results as parameter.
     */
    static ajaxPropertyDetails(endpoints, propertyName, callback = null){
        if (!Array.isArray(endpoints) || endpoints.length === 0) return false;

        var results = [];

        _.forEach(endpoints, (endpoint, i) => {

            console.log('Obtaining ' + propertyName + '[' + i + '] via AJAX from ' + endpoint);

            ajax.load(endpoint + '?format=json&frame=embedded', (result) => {
                results.push(result);
                this.setState((currState)=>{
                    var newState = {};
                    newState['details_' + propertyName] = results;
                    return newState;
                }, ()=>{
                    if (typeof callback === 'function'){
                        callback(results);
                    }
                });
                console.log('Obtained details_'+ propertyName +' (' + results.length + ') via AJAX: ', results);
            }, 'GET', (res)=>{
                logger.error('Failed to get ' + propertyName + ': ' + endpoint);
            });
        });
    }

    static propTypes = {
        details         : PropTypes.array,        // Complete detail data for all list items, if available.
        endpoints       : PropTypes.array,      // Endpoints to use for fetching detail data. Required if details is empty.
        propertyName    : PropTypes.string,  // Property from which array is gotten.
        renderItem      : PropTypes.func,      // Function used to render child FormattedInfoBlocks
        ajaxCallback    : PropTypes.func,    // Optional callback to invoke on recieving ajax'd data, taking results as a param.
        fallbackMsg     : PropTypes.any,      // Fallback text or component(s) if endpoints not set.
        loading         : PropTypes.bool,         // Override this.state.loading - only do so if providing details array prop.
        debug           : PropTypes.bool            // Verbose lifecycle logging.
    };

    static defaultProps = {
        'propertyName' : 'property',
        'fallbackMsg' : 'Not set'
    };

    static propEndpointsValid(props){
        return props.endpoints && Array.isArray(props.endpoints) && props.endpoints.length > 0 && _.every(props.endpoints, function(ep){ return typeof ep === 'string' && ep.length > 0; });
    }

    static propDetailsValid(props){
        return (
            (props.details && Array.isArray(props.details) && props.details.length > 0) &&
            (!props.endpoints || (FormattedInfoBlockList.propEndpointsValid(props) && props.endpoints.length === props.details.length))
        );
    }

    static getInitialDetailsState(props){
        var state = {};
        if (this.propDetailsValid(props)) {
            state['details_' + props.propertyName] = props.details;
        } else {
            state['details_' + props.propertyName] = null;
        }
        return state;
    }

    constructor(props){
        super(props);
        this.state = _.extend(FormattedInfoBlockList.getInitialDetailsState(props), {
            'loading' : props.loading || (!FormattedInfoBlockList.propDetailsValid(props) && FormattedInfoBlockList.propEndpointsValid(props) ? true : null),
            'mounted' : false
        });
    }

    componentDidMount(){
        var { propertyName, endpoints, ajaxCallback } = this.props;
        if (!this.state['details_' + propertyName] && FormattedInfoBlockList.propEndpointsValid(this.props)){
            FormattedInfoBlockList.ajaxPropertyDetails.call(this, endpoints, propertyName, (results) => {
                if (results.length === endpoints.length){
                    this.setState({ 'loading' : false });
                }
                if (typeof ajaxCallback === 'function'){
                    ajaxCallback(results);
                }
            });
        }
        this.setState({ mounted : true });
    }

    componentDidUpdate(pastProps){
        const { details, loading } = this.props;
        let stateChange = {};
        if (details !== pastProps.details){
            stateChange = FormattedInfoBlockList.getInitialDetailsState(this.props);
        }
        if (loading !== pastProps.loading && this.state.loading !== pastProps.loading){
            stateChange.loading = newProps.loading;
        }
        if (_.keys(stateChange).length > 0){
            this.setState(stateChange);
        }
    }

    render(){
        const { fallbackMsg, renderItem, propertyName, endpoints, details } = this.props;
        const { loading, transitionDelayElapsed } = this.state;

        if (!FormattedInfoBlockList.propDetailsValid(this.props) && !FormattedInfoBlockList.propEndpointsValid(this.props) && !loading){
            return (
                <span className="not-set">{ fallbackMsg }</span>
            );
        }

        var blocks;

        if (this.state && Array.isArray(this.state['details_' + propertyName])){
            blocks = _.map(this.state['details_' + propertyName], (item,i) => {
                if (loading && !item){
                    return (
                        <li key={propertyName + '-' + i} className={propertyName + "-item"}>
                            <i className="icon icon-spin fas icon-circle-notch"></i>
                        </li>
                    );
                }
                return <li key={propertyName + '-' + i} className={propertyName + "-item"}>{ renderItem(item) }</li>;
            });
        } else if (loading){
            blocks = _.map(endpoints || [null], function(item,i){
                return (
                    <li key={propertyName + '-' + i} className={propertyName + "-item"}>
                        <i className="icon icon-spin fas icon-circle-notch"></i>
                    </li>
                );
            });
        }
        const ulCls = "formatted-info-panel-list" + (loading ? ' loading' : (loading === false ? ' loaded' : ''));
        return <ul id={propertyName} className={ulCls}>{ blocks }</ul>;
    }

}

/**
 * Formats a lab, award, or potentially other object to appear in a small rectangle that can be included in a sidebar.
 * Also offers mix-in functions to help AJAX in the required details to the parent component's state.
 *
 * Also contains FormattedInfoBlock.List which is meant to display a list of FormattedInfoBlocks, and potentially AJAX in details for them.
 *
 * @class FormattedInfoBlock
 * @type {Component}
 */
export class FormattedInfoBlock extends React.Component {

    static List = FormattedInfoBlockList

    /**
     * Set a parent component's state to have 'details_' + propertyName data fetched via AJAX.
     * Must supply 'this' from parent component, via .call/.apply/.bind(this, args...),
     * AKA use like a mixin.
     *
     * @deprecated
     * @param {string} endpoint - REST endpoint to get from. Usually a '@id' field in schema-derived JSON data.
     * @param {string} propertyName - The second part of state variable to save results into, after 'details_'. E.g. 'lab' for 'details_lab'.
     * @param {function} [callback] - Optional callback.
     *
     * @example
     * componentDidMount : function(){
     *     if (typeof this.props.context.lab == 'string' && this.props.context.lab.length > 0){
     *         FormattedInfoBlock.ajaxPropertyDetails.call(this, this.props.context.lab, 'lab');
     *     }
     * },
     */
    static ajaxPropertyDetails(endpoint, propertyName, callback = null){
        console.info('Obtaining details_' + propertyName + ' via AJAX.');
        ajax.load(endpoint + '?format=json&frame=embedded', function(result){
            var newStateAddition = {};
            newStateAddition['details_' + propertyName] = result;
            this.setState(newStateAddition, ()=>{
                if (typeof callback == 'function'){
                    callback(result);
                }
            });
            console.info('Obtained details_' + propertyName + ' via AJAX:', result);
        }.bind(this), 'GET', function(error){
            var newStateAddition = {};
            newStateAddition['details_' + propertyName] = {
                'error' : true,
                'body' : error
            };
            this.setState(newStateAddition);
            logger.error("AJAX Error: " + (error.title || 'N/A') + ' | ' +
                'Detail: ' + (error.detail || 'N/A') + ' | ' +
                'Description: ' + (error.description || 'N/A'));
            analytics.event('FormattedInfoBlock', 'ERROR', {
                eventLabel : (
                    "AJAX Error: "  + (error.title       || 'N/A') + ' | ' +
                    'Detail: '      + (error.detail      || 'N/A') + ' | ' +
                    'Description: ' + (error.description || 'N/A')
                ),
                eventValue : error.code || null
            });
        }.bind(this));
    }

    /**
     * Use like a mixin from a component which parents a FormattedInfoBlock(s).
     *
     * @deprecated
     * @param {string} propertyName - Name/key of linkTo property to fetch.
     * @param {string|Object} contextProperty - What we have as value in context, e.g. uuid or object with @id.
     * @param {function} cb - Callback function passed down to ajaxPropertyDetails.
     * @returns {boolean} Whether an AJAX load/fetch was initiated.
     */
    static onMountMaybeFetch(propertyName = 'lab', contextProperty = (this.props.context && this.props.context.lab), cb = null){
        if (typeof contextProperty == 'string' && contextProperty.length > 0){
            FormattedInfoBlock.ajaxPropertyDetails.call(this, contextProperty, propertyName, cb);
            return true;
        }
        if (contextProperty && typeof contextProperty === 'object'){

            if (typeof contextProperty.error === 'string' && contextProperty.error.toLowerCase() === 'no view permissions') return false;
            var atId = object.itemUtil.atId(contextProperty);
            if (_.keys(contextProperty).length <= 3 && atId && typeof contextProperty.display_title === 'string'){
                FormattedInfoBlock.ajaxPropertyDetails.call(this, atId, propertyName, cb);
                return true;
            }
        }
        return false;
    }

    /**
     * Preset generator for Lab detail block.
     * @see FormattedInfoBlock.generate
     *
     * @param {Object} details_lab - Object containing Lab Details.
     * @param {boolean|string} [includeIcon=true] - Include icon or not. Supply string to override default lab icon. Defaults to true.
     * @param {boolean} [includeLabel=true] - Include 'Lab >' label in top left corner, or not. Defaults to true.
     * @param {boolean} [includeDetail=true] - Include description/details or not. Defaults to true.
     * @param {boolean} [isMounted=false] - Whether parent component is mounted and we can access e.g. browser window API.
     * @param {string} [key] - Unique key to add to generated element, supply if generating a collection/array.
     * @returns {JSX.Element} FormattedBlock instance.
     */
    static Lab(details_lab, includeIcon = true, includeLabel = true, includeDetail = true, isMounted = false, key = null){

        if (details_lab && typeof details_lab.error !== 'undefined' && details_lab.error) {
            return null;
            //return FormattedInfoBlock.Error.apply(this, arguments);
        }

        let innerContent = null;
        let contactPersons = null;

        if (includeDetail && details_lab){
            const { correspondence = [] } = details_lab;
            contactPersons = correspondence.filter(function({ '@id': cpID, display_title, contact_email }){
                return cpID && display_title && contact_email;
            }).map(function(contactPerson, idx){
                return <ContactPersonListItem contactPerson={contactPerson} key={contactPerson['@id'] || idx} />;
            });

            if (contactPersons && contactPersons.length > 0){
                // Point of contact(s) for Lab which has view permission(s)
                innerContent = (
                    <div>
                        <div className="address">{ generateAddressString(details_lab) }</div>
                        <div className="correspondence">
                            <h6 className="mt-08 mb-03 text-500">Correspondence:</h6>
                            <ul>{ contactPersons }</ul>
                        </div>
                    </div>
                );
            } else {
                innerContent = generateAddressString(details_lab);
            }
        }

        return FormattedInfoBlock.generate(
            details_lab,                                                                                // detail
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-users fas" : null), // includeIcon
            includeLabel ? "Lab" : null,                                                                // includeLabel
            innerContent,                                                                               // contents
            'lab',                                                                                      // extraContainerClassName
            contactPersons ? 'contact' : 'address',                                                      // extraDetailClassName
            key                                                                                         // key
        );
    }

    /**
     * Preset generator for Award detail block.
     * @see FormattedInfoBlock.Lab
     */
    static Award(details_award, includeIcon = true, includeLabel = true, includeDetail = true, key = null){
        if (details_award && typeof details_award.error !== 'undefined' && details_award.error) {
            return null;
            //return FormattedInfoBlock.Error.apply(this, arguments);
        }
        return FormattedInfoBlock.generate(
            details_award,
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-university fas" : null),
            includeLabel ? "Award" : null,
            details_award && includeDetail ? details_award.project : null,
            'award',
            'project',
            key
        );
    }

    /**
     * Preset generator for User detail block.
     * @see FormattedInfoBlock.Lab
     */
    static User(details_user, includeIcon = true, includeLabel = true, includeDetail = true, key = null){
        if (details_user && typeof details_user.error !== 'undefined' && details_user.error) {
            return null;
            //return FormattedInfoBlock.Error.apply(this, arguments);
        }
        return FormattedInfoBlock.generate(
            details_user,
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-user fas" : null),
            includeLabel ? (typeof includeLabel === 'string' ? includeLabel : "Submitted By") : null,
            details_user && includeDetail ? (
                (details_user.lab && details_user.lab.display_title) || details_user.job_title || details_user.timezone
            ) : null,
            'user',
            'project',
            key
        );
    }

    static Error(details_error, includeIcon = true, includeLabel = true, includeDetail = true, key = null){
        return FormattedInfoBlock.generate(
            details_error.body,
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-exclamation-circle fas" : null),
            includeLabel ? "Error" : null,
            details_error && details_error.body && includeDetail ? details_error.body.detail : null,
            'error-block',
            'error-message',
            key
        );
    }

    static generate(detail, iconClass = null, label = null, contents = null, extraContainerClassName = null, extraDetailClassName = null, key = null){
        return (
            <FormattedInfoBlock key={key} label={label} iconClass={iconClass}
                title={detail.display_title} titleHref={object.itemUtil.atId(detail)}
                extraContainerClassName={extraContainerClassName} extraDetailClassName={extraDetailClassName}
                loading={!detail} children={contents}/>
        );
    }

    static propTypes = {
        'label'                     : PropTypes.string,
        'iconClass'                 : PropTypes.string,
        'title'                     : PropTypes.string,
        'titleHref'                 : PropTypes.string,
        'detailContent'             : PropTypes.any,
        'extraContainerClassName'   : PropTypes.string,
        'extraDetailClassName'      : PropTypes.string,
        'loading'                   : PropTypes.bool,
        'debug'                     : PropTypes.bool    // Verbose log messages.
    }


    static defaultProps = {
        'label'                     : null,
        'title'                     : null,
        'titleHref'                 : "#",
        'detailContent'             : null,
        'extraContainerClassName'   : null,
        'extraDetailClassName'      : null,
        'loading'                   : false,
        'children'                  : null, // Inner contents of <FormattedInfoBlock>...</FormattedInfoBlock>
        'debug'                     : false
    }

    constructor(props){
        super(props);
        this.outerClassName = this.outerClassName.bind(this);
        this.state = {
            transitionDelayElapsed : !props.loading,
            mounted : false
        };
    }

    componentDidMount(){
        if (this.props.debug) console.info('FormattedInfoBlock > Mounted');
        this.setState({ mounted : true });
    }

    componentDidUpdate(prevProps, prevState){
        if (prevProps.loading === true && this.props.loading === false && !this.state.transitionDelayElapsed){
            if (this.props.debug) console.info('FormattedInfoBlock > updated this.props.loading');

            if (this.state.mounted && !isServerSide()){
                setTimeout(()=>{
                    if (this.props.debug) console.info('FormattedInfoBlock > setting state.transitionDelayElapsed');
                    this.setState({ transitionDelayElapsed : true });
                }, 100);
            }

        }
    }

    outerClassName(){
        var { iconClass, label, detailContent, children, title, loading, extraContainerClassName } = this.props;
        var classes = ["formatted-info-panel"];
        if (!iconClass) classes.push('no-icon');
        if (!label) classes.push('no-label');
        if (detailContent === null && children === null) classes.push('no-details');
        if (!title) classes.push('no-title');
        if (loading) classes.push('loading');
        else classes.push('loaded');
        if (this.state.transitionDelayElapsed) classes.push('transitioned');
        if (extraContainerClassName) classes.push(extraContainerClassName);
        return classes.join(' ');
    }

    render(){
        var { loading, iconClass, detailContent, children, title, titleHref, extraDetailClassName, label } = this.props;
        var innerContent;

        if (loading) {
            innerContent = (
                <div className="row">
                    <div className="col-12 text-center" style={{ color : '#d2d2d2', fontSize : '22px', paddingTop : 3 }}>
                        <i className="icon icon-spin fas icon-circle-notch"></i>
                    </div>
                </div>
            );
        } else {
            innerContent = (
                <div className="row loaded">
                    { iconClass ? <div className="col-2 col-lg-1 icon-container px-0"><i className={"icon " + iconClass}/></div> : null }
                    <div className={"details-col " + (iconClass ? "col-10 col-lg-11" : "col-sm-12") + (!detailContent && !children ? ' no-more-details' : '')}>
                        { title ?
                            titleHref ?
                                <h5 className="block-title"><a href={ titleHref } title={title}>{ title }</a></h5>
                                : <h5 className="block-title no-link">{ title }</h5>
                            : null }
                        { detailContent || children ? <div className={"more-details " + extraDetailClassName} children={detailContent || children} /> : null }
                    </div>
                </div>
            );
        }
        return (
            <div className={ this.outerClassName() }>
                { label ? <h6 className="info-panel-label">{ label }</h6> : null }
                { innerContent }
            </div>
        );
    }

}
