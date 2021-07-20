'use strict';

import React from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import url from 'url';

import { getAbstractTypeForType, getAllSchemaTypesFromSearchContext } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import { SearchView as CommonSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/SearchView';
import { console, isSelectAction,schemaTransforms, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { columnExtensionMap } from './columnExtensionMap';
import { Schemas } from './../util';
import { TitleAndSubtitleBeside, PageTitleContainer, TitleAndSubtitleUnder, pageTitleViews, EditingItemPageTitle, StaticPageBreadcrumbs } from './../PageTitle';
import { replaceString as placeholderReplacementFxn } from './../static-pages/placeholders';


/**
 * Function which is passed into a `.filter()` call to
 * filter context.facets down, usually in response to frontend-state.
 *
 * Currently is meant to filter out type facet if we're in selection mode,
 * as well as some fields from embedded 'experiment_set' which might
 * give unexpected results.
 *
 * @todo Potentially get rid of this and do on backend.
 *
 * @param {{ field: string }} facet - Object representing a facet.
 * @returns {boolean} Whether to keep or discard facet.
 */
export function filterFacet(facet, currentAction, session){
    // Set in backend or schema for facets which are under development or similar.
    if (facet.hide_from_view) return false;

    // Remove the @type facet while in selection mode.
    if (facet.field === 'type' && isSelectAction(currentAction)) return false;

    // Most of these would only appear if manually entered into browser URL.
    if (facet.field.indexOf('experiments.experiment_sets.') > -1) return false;
    if (facet.field === 'experiment_sets.@type') return false;
    if (facet.field === 'experiment_sets.experimentset_type') return false;

    return true;
}

/**
 * Filter down the `@type` facet options down to abstract types only (if none selected) for Search.
 * Also, whatever defined in `filterFacet`.
 */
export function transformedFacets(href, context, currentAction, session, schemas){

    // Clone/filter list of facets.
    // We may filter out type facet completely at this step,
    // in which case we can return out of func early.
    const facets = _.filter(
        context.facets,
        function(facet){
            return filterFacet(facet, currentAction, session);
        }
    );

    const searchItemTypes = getAllSchemaTypesFromSearchContext(context); // "Item" is excluded

    if (searchItemTypes.length > 0) {
        logger.info("A (non-'Item') type filter is present. Will skip filtering Item types in Facet.");
        // Keep all terms/leaf-types - backend should already filter down to only valid sub-types through
        // nature of search itself.

        if (searchItemTypes.length > 1) {
            logger.warning("More than one \"type\" filter is selected. This is intended to not occur, at least as a consequence of interacting with the UI. Perhaps have entered multiple types into URL.");
        }

        return facets;
    }

    // Find facet for '@type'
    const typeFacetIndex = _.findIndex(facets, { 'field' : 'type' });

    if (typeFacetIndex === -1) {
        logger.error('"Could not get type facet, though some filter for it is present."');
        return facets;
    }

    // Avoid modifying in place.
    facets[typeFacetIndex] = _.clone(facets[typeFacetIndex]);

    // Show only base types (exclude leaf types) for when no non-Item type filter is present.
    facets[typeFacetIndex].terms = _.filter(facets[typeFacetIndex].terms, function(itemType){
        const parentType = getAbstractTypeForType(itemType.key, schemas);
        return !parentType || parentType === itemType.key;
    });

    return facets;
}


export default class SearchView extends React.PureComponent {

    constructor(props){
        super(props);
        this.memoized = {
            transformedFacets: memoize(transformedFacets)
        };
    }

    render(){
        const { isFullscreen, href, context, currentAction, session, schemas } = this.props;
        const facets = this.memoized.transformedFacets(href, context, currentAction, session, schemas);
        const tableColumnClassName = "expset-result-table-fix col-12" + (facets.length > 0 ? " col-sm-7 col-lg-8 col-xl-" + (isFullscreen ? '10' : '9') : "");
        const facetColumnClassName = "col-12 col-sm-5 col-lg-4 col-xl-" + (isFullscreen ? '2' : '3');
        return (
            <div className="container" id="content">
                <CommonSearchView {...this.props} {...{ columnExtensionMap, tableColumnClassName, facetColumnClassName, facets, placeholderReplacementFxn }}
                    termTransformFxn={Schemas.Term.toName} separateSingleTermFacets />
            </div>
        );
    }
}

const SearchViewPageTitle = React.memo(function SearchViewPageTitle(props) {
    const { context, schemas, currentAction, alerts, session, href } = props;
    if (schemaTransforms.getSchemaTypeFromSearchContext(context) === "Publication") {
        return (
            <PageTitleContainer alerts={alerts}>
                <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                <TitleAndSubtitleUnder>
                    Publications
                </TitleAndSubtitleUnder>
            </PageTitleContainer>
        );
    }

    if (currentAction === "add") {
        // Fallback unless any custom PageTitles registered for @type=<ItemType>SearchResults & currentAction=add
        return <EditingItemPageTitle {...{ context, schemas, currentAction, alerts }} />;
    }

    const searchType = schemaTransforms.getSchemaTypeFromSearchContext(context);
    const thisTypeTitle = schemaTransforms.getTitleForType(searchType, schemas);

    if (currentAction === "selection") {
        return (
            <PageTitleContainer alerts={alerts}>
                <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                <TitleAndSubtitleUnder subtitle="Select an Item and click the Apply button." subTitleClassName="smaller">
                    <span className="title">Selecting</span><span className="prominent subtitle">{thisTypeTitle}</span>
                </TitleAndSubtitleUnder>
            </PageTitleContainer>
        );
    }
    if (currentAction === "multiselect") {
        return (
            <PageTitleContainer alerts={alerts}>
                <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
                <TitleAndSubtitleUnder subtitle="Select one or more Items and click the Apply button." subTitleClassName="smaller">
                    <span className="title">Selecting</span><span className="prominent subtitle">{thisTypeTitle}</span>
                </TitleAndSubtitleUnder>
            </PageTitleContainer>
        );
    }

    if (searchType === "Publication" && !isSelectAction(currentAction)) {
        return null;
    }
    const subtitle = thisTypeTitle ? (
        <span><small className="text-300">for</small> {thisTypeTitle}</span>
    ) : null;

    return (
        <PageTitleContainer alerts={alerts}>
            <StaticPageBreadcrumbs {...{ context, session, href }} key="breadcrumbs" />
            <TitleAndSubtitleBeside subtitle={subtitle}>
                Search
            </TitleAndSubtitleBeside>
        </PageTitleContainer>
    );
});

pageTitleViews.register(SearchViewPageTitle, "Search");
pageTitleViews.register(SearchViewPageTitle, "Search", "selection");
pageTitleViews.register(SearchViewPageTitle, "Search", "multiselect");
pageTitleViews.register(SearchViewPageTitle, "Search", "add");
