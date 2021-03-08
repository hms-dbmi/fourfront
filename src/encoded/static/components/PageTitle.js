'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import memoize from 'memoize-one';

import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { console, object, JWT, layout, schemaTransforms, isSelectAction, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import Registry from '@hms-dbmi-bgm/shared-portal-components/es/components/navigation/components/Registry';

import { content_views } from './globals';
import { typedefs } from './util';
import jsonScriptEscape from './../libs/jsonScriptEscape';
import { EditableField, FieldSet } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/EditableField';
// eslint-disable-next-line no-unused-vars
const { Item, JSONContentResponse, SearchResponse } = typedefs;

/**
 * Other components may import this and register title views to it.
 * Custom map-like structure from ENCODE which allows 2 keys.
 *
 * @see index.js and globals.js for other examples.
 */
export const pageTitleViews = new Registry();


/** @todo add proptypes (?) */
export const PageTitleSection = React.memo(function PageTitle(props){
    const { context, currentAction, schemas, alerts, session, href } = props;
    // See if any views register their own custom-er title view.
    const FoundTitleView = pageTitleViews.lookup(context, currentAction);
    if (FoundTitleView){
        return <FoundTitleView {...props} />;
    }

    // Else use fallback(s)

    if (isEditingFormView(context, currentAction)){
        return <EditingItemPageTitle {...{ currentAction, context, schemas, alerts }} />;
    }

    if (isStaticPage(context)){
        return <StaticPageTitle {...{ context, schemas, currentAction, alerts, session, href }} />;
    }

    if (isAnItem(context)){
        //return null; // Item Pages show titles themselves
        return <GenericItemPageTitle {...{ context, schemas, alerts }}/>;
    }

    return (
        <PageTitleContainer alerts={alerts}>
            <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
            <OnlyTitle>{ object.itemUtil.getTitleStringFromContext(context) || <em>Unknown</em> }</OnlyTitle>
        </PageTitleContainer>
    );

});


export const EditingItemPageTitle = React.memo(function EditingItemPageTitle(props){
    const { currentAction, context, schemas, alerts, session, href } = props;
    const subtitle = currentAction === 'edit' ? object.itemUtil.getTitleStringFromContext(context) // on item view
        : currentAction === 'create' ? schemaTransforms.getItemTypeTitle(context, schemas) // on item view
            : currentAction === 'add' ? schemaTransforms.getSchemaTypeFromSearchContext(context, schemas) // on search view
                : schemaTransforms.getItemTypeTitle(context, schemas);
    return (
        <PageTitleContainer alerts={alerts}>
            <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
            <TitleAndSubtitleBeside subtitle={subtitle}>
                { currentAction === 'edit' ? 'Editing' : 'Creating' }
            </TitleAndSubtitleBeside>
        </PageTitleContainer>
    );
});

/** Title Parts/Components **/


/** All custom page title views should include this unless alerts strictly not needed */
export const PageTitleContainer = React.memo(function PageTitleContainer({ children, alerts, alertsContainerClassName, className = "container" }){
    return (
        <div id="page-title-container" className={className}>
            { children }
            <Alerts alerts={alerts} className={alertsContainerClassName} />
        </div>
    );
});


export const OnlyTitle = React.memo(function OnlyTitle({ children, className, ...passProps }){
    return (
        <h1 className={"page-title top-of-page " + (className || '')} {...passProps}>
            { children }
        </h1>
    );
});

export const TitleAndSubtitleUnder = React.memo(function TitleAndSubtitleUnder(props) {
    const { children, subtitle, title, className, subTitleClassName, ...passProps } = props;

    return (
        <h1 className={"page-title top-of-page " + (className || '')} {...passProps}>
            {children || title}
            <div className={"page-subtitle " + (subTitleClassName || '')}>
                {subtitle}
            </div>
        </h1>
    );
});

export const TitleAndSubtitleBeside = React.memo(function TitleAndSubtitleNextTo(props){
    const { children, subtitle, className, subTitleClassName = "prominent", ...passProps } = props;
    return (
        <h1 className={"page-title top-of-page " + (className || '')} {...passProps}>
            <span className="title">
                { children }
            </span>
            <span className={"subtitle " + (subTitleClassName || '')}>
                { subtitle }
            </span>
        </h1>
    );
});



/** Composed Titles **/

const StaticPageTitle = React.memo(function StaticPageTitle(props){
    const { alerts, breadCrumbsVisible, session, context, href } = props;
    const {
        display_title: title,
        'table-of-contents' : { enabled: tocEnabled = false } = {},
        '@type' : itemTypes = [],
        '@id' : contextID
    } = context || {};
    const hasToc = (contextID && itemTypes.indexOf('StaticPage') > -1 && tocEnabled) || false;
    const commonCls = "col-12" + (hasToc ? " col-lg-9" : '');
    return (
        <PageTitleContainer alerts={alerts} className="container" alertsContainerClassName={commonCls + " mt-2"}>
            <div className="row">
                { !breadCrumbsVisible ?
                    <StaticPageBreadcrumbs {...{ context, session, href, hasToc }}
                        key="breadcrumbs" className={commonCls}/>
                    : null }
                <OnlyTitle className={commonCls}>{ title }</OnlyTitle>
            </div>
        </PageTitleContainer>
    );
});

/** Based on 4DN content views & metadata, to be updated re: CGAP */
const GenericItemPageTitle = React.memo(function GenericItemPageTitle(props){
    const { context, schemas, alerts, href, session, className } = props;
    let itemTitle = object.itemUtil.getTitleStringFromContext(context);
    const itemTypeTitle = schemaTransforms.getItemTypeTitle(context, schemas);
    const isTitleAnAccession = itemTitle && object.itemUtil.isDisplayTitleAccession(context, itemTitle, true);

    if (itemTitle && isTitleAnAccession){
        // Don't show accession as title (Item Pages currently show it elsewhere)
        // But show rest of title if it is in form 'Something - ACCESSION'
        const isTherePrepend = typeof context.accession === 'string' && context.accession.length >= 12 && itemTitle.indexOf(' - ' + context.accession) > -1;
        if (isTherePrepend){
            const remainderTitle = itemTitle.replace(' - ' + context.accession, '');
            if (remainderTitle.length > 0){
                return (
                    <PageTitleContainer alerts={alerts}>
                        <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                        <TitleAndSubtitleBeside subtitle={remainderTitle}>
                            { itemTypeTitle }
                        </TitleAndSubtitleBeside>
                    </PageTitleContainer>
                );
            }
        }
        // We currently render accession in ItemView so exclude it here if it is the title.
        return (
            <PageTitleContainer alerts={alerts}>
                <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                <OnlyTitle>{itemTypeTitle}</OnlyTitle>
            </PageTitleContainer>
        );
    }

    if (itemTitle && itemTitle.indexOf(context['@type'][0] + ' from ') === 0){
        // Our title is in form of 'CellCultureDetails from 2018-01-01' or something, lets make it prettier.
        // Becomes ~ `<title>CellCultureDetails</title><subtitle> from January 1st, 2018</subtitle>`
        const dateCreatedTitle = (
            (context.date_created && <span>from <LocalizedTime timestamp={context.date_created} /></span>) ||
            itemTitle.replace(context['@type'][0] + ' ', '')
        );
        return (
            <PageTitleContainer alerts={alerts}>
                <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                <TitleAndSubtitleBeside subtitle={dateCreatedTitle}>{ itemTypeTitle }</TitleAndSubtitleBeside>
            </PageTitleContainer>
        );
    }

    //Custom Higlass editable title display
    const editAction = _.findWhere(context.actions, { 'name': 'edit' });
    const isEditableHiglassTitle = context && (context['@type'].indexOf('HiglassViewConfig') > -1) && editAction;
    if (isEditableHiglassTitle) {
        itemTitle = (
            <FieldSet context={context}
                schemas={schemas} href={href}>
                <EditableField labelID="title" fieldType="text" style="row-without-label" fallbackText="click to add new title" placeholder={'title'} buttonAlwaysVisible={true} outerClassName="higlass-editable-page-title">
                </EditableField>
            </FieldSet>
        );
        return (
            <PageTitleContainer alerts={alerts}>
                <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                <TitleAndSubtitleUnder context={context} subtitle={itemTitle}>{itemTypeTitle}</TitleAndSubtitleUnder>
            </PageTitleContainer>
        );
    }

    if (itemTitle){
        const itemTypeHierarchy = schemaTransforms.schemasToItemTypeHierarchy(schemas);
        if (!context.accession && !itemTypeHierarchy[context['@type'][0]] && typeof itemTitle === 'string' && itemTitle.length > 20) {
            // Item views will currently show accession &/or abstract type.
            // While this is case, we need to test for them here for layouting.
            // If itemTitle is < 20chars might as well show it beside itemTypeTitle, anyway.
            return (
                <PageTitleContainer alerts={alerts}>
                    <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                    <TitleAndSubtitleUnder context={context} subtitle={itemTitle}>{ itemTypeTitle }</TitleAndSubtitleUnder>
                </PageTitleContainer>
            );
        } else {
            return (
                <PageTitleContainer alerts={alerts}>
                    <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                    <TitleAndSubtitleBeside subtitle={itemTitle}>{ itemTypeTitle }</TitleAndSubtitleBeside>
                </PageTitleContainer>
            );
        }
    }

    // Default
    return <PageTitleContainer alerts={alerts}><OnlyTitle>{ itemTypeTitle }</OnlyTitle></PageTitleContainer>;

});


/** Check whether current context has an `@type` list containing "StaticPage". */
const isStaticPage = memoize(function(context){
    if (Array.isArray(context['@type'])){
        if (context['@type'][context['@type'].length - 1] === 'Portal' && context['@type'][context['@type'].length - 2] === 'StaticPage'){
            if (context['@type'].indexOf('HomePage') > -1) return false; // Exclude home page
            return true;
        }
    }
    return false;
});

const isAnItem = memoize(function(context){
    if (object.itemUtil.isAnItem(context) && Array.isArray(context['@type'])){
        if (context['@type'].indexOf('Item') > -1){
            return true;
        }
    }
    return false;
});

const isEditingFormView = memoize(function(context, currentAction){
    return (
        currentAction &&
        { 'edit':1, 'create':1, 'add':1 }[currentAction] &&
        (object.isAnItem(context) || (context['@type'] && context['@type'].indexOf('Search') > -1))
    );
});


/**
 * Renders out breadcrumb links under page title for static help pages.
 * Also adds JSON-LD structured data breadcrumbs for SEO.
 *
 * Is used as part of PageTitle.
 * @memberof PageTitle
 */
export class StaticPageBreadcrumbs extends React.PureComponent {

    /**
     * Get ancestors of current Item JSON.
     *
     * @param {Item} context - Current Item JSON.
     * @returns {{ '@id' : string }[]} List of ancestors as a JSON list.
     */
    static getAncestors(context){
        if (!context.parent || !context.parent.display_title) return null;
        var list = [];
        var node = context.parent;
        while (node){
            list.push(node);
            node = node.parent;
        }
        list.reverse();
        list.push(context);
        return list;
    }

    /**
     * @constant
     * @public
     * @ignore
     */
    static defaultProps = {
        'pageTitleStyle' : {}
    };

    /** @ignore */
    constructor(props){
        super(props);
        this.renderCrumb = this.renderCrumb.bind(this);
        this.seoMetadata = this.seoMetadata.bind(this);
        this.memoized = {
            getAncestors : memoize(StaticPageBreadcrumbs.getAncestors)
        };
    }

    /**
     * Renders each individual crumb.
     *
     * @private
     * @param {Item} ancestor   JSON representing an ancestor. Should have at least an @id and a display_title.
     * @param {number} index    Current ancestor index.
     * @param {Item[]} all      List of all ancestors being iterated.
     * @returns {JSX.Element} A div element representing a breadcrumb.
     */
    renderCrumb(ancestor, index, all){
        const { '@id' : ancestorID, display_title, name: ancestorPathName } = ancestor;
        const { context: { '@id' : contextID } } = this.props;
        const inner = ancestorID === contextID ? null : (
            <a href={ancestorID}>{ display_title }</a>
        );
        return (
            <div className="static-breadcrumb" data-name={ancestorPathName} key={ancestorID}>
                { index > 0 ? <i className="icon icon-fw icon-angle-right fas"/> : null }
                { inner }
            </div>
        );
    }

    /**
     * Renders an edit button to right side of page for people with edit permission.
     *
     * @private
     */
    editButton(){
        var { session, context, pageTitleStyle } = this.props;
        if (session && context && Array.isArray(context['@type']) && context['@type'].indexOf('StaticPage') > -1){

            if (Array.isArray(context.actions)){
                var editAction = _.findWhere(context.actions, { 'name' : 'edit' });
                if (editAction && editAction.href){
                    return (
                        <div className="static-edit-button pull-right" style={_.pick(pageTitleStyle, 'marginTop')}>
                            <i className="icon icon-fw icon-pencil fas"/> <a href={editAction.href} data-tip="Edit this Static Page">Edit</a>
                        </div>
                    );
                }
            }
        }
        return null;
    }

    /**
     * Renders out JSON-LD structured data version of our breadcrumbs for
     * search engine consumption.
     *
     * @see https://developers.google.com/search/docs/data-types/breadcrumb
     *
     * @private
     * @param {{ display_title: string }[]} ancestors - List of ancestors, including self.
     * @returns {JSX.Element} A script element containing JSON-LD data.
     */
    seoMetadata(ancestors){
        const { href } = this.props;
        if (!ancestors || !Array.isArray(ancestors) || ancestors.length < 2) return null;
        var hrefParts = memoizedUrlParse(href),
            baseDomain = (hrefParts.protocol || '') + '//' + hrefParts.host,
            structuredJSON = {
                "@context": "http://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement" : _.map(ancestors, function(item, idx){
                    return {
                        "@type" : "ListItem",
                        "position" : idx + 1,
                        "item" : {
                            "name" : item.title || item.display_title,
                            "@id" : baseDomain + object.itemUtil.atId(item)
                        }
                    };
                })
            };
        return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonScriptEscape(JSON.stringify(structuredJSON)) }} />;
    }

    render(){
        const { children = null, context = null, hasToc, className } = this.props;
        let cls = (
            "static-page-breadcrumbs clearfix" +
            (className ? " " + className : "") +
            (hasToc ? ' page-has-toc' : '')
        );

        if (children) {
            return  <div className={cls}>{ children }</div>;
        }

        const ancestors = context && this.memoized.getAncestors(context);
        const crumbs = Array.isArray(ancestors) && ancestors.length > 0 && ancestors.map(this.renderCrumb);
        cls += (!crumbs ? ' empty' : '');

        return  (
            <div className={cls}>
                { crumbs }
                { this.editButton() }
                { this.seoMetadata(ancestors) }
            </div>
        );
    }
}
