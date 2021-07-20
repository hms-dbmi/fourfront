'use strict';

import React from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import { pie, arc } from 'd3-shape';
import PropTypes from 'prop-types';

import { console, object, schemaTransforms, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

// eslint-disable-next-line no-unused-vars
import { Item } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/typedefs';


export class BadgesTabView extends React.PureComponent {

    static getTabObject(props){
        const { context } = props;

        let badgeSingularTitle = "Badge";

        const badgesByClassification = BadgesTabView.badgesByClassification(context);
        const classifications = _.keys(badgesByClassification);

        if (classifications.length === 1){
            [ badgeSingularTitle ] = classifications;
        }

        const badgeList = BadgesTabView.getBadgesList(context);
        const badgeListLen = (badgeList && badgeList.length) || 0;
        const titleStr = " " + badgeSingularTitle + (badgeListLen > 1 ? "s" : "");

        return {
            tab : <span><SummaryIcon context={context} />{ titleStr }</span>,
            disabled : badgeListLen === 0,
            key : "badges",
            content : <BadgesTabView {...props} />
        };
    }

    static getBadgesList = memoize(function(context){
        var badges = context && context['aggregated-items'] && context['aggregated-items'].badges;
        if (!Array.isArray(badges) || badges.length === 0) return null;
        return badges;
    });

    /** ES6 Maps preserve order, Objects' keys' order may not be preserved depending on JS interpreter/version. */
    static classificationMap = new Map([
        [ "commendation",   "Commendation" ],
        [ "warning",        "Warning" ]
    ]);

    static classificationMapAsObject = memoize(function(classificationMap = BadgesTabView.classificationMap){
        return object.mapToObject(classificationMap);
    })

    static badgeClassification(badge, propMapping = BadgesTabView.classificationMap){
        var badgeItem = badge && badge.item && badge.item.badge,
            propertyToTestPresenceOf, classificationTitle;

        for ([propertyToTestPresenceOf, classificationTitle] of propMapping){
            if (typeof badgeItem[propertyToTestPresenceOf] === 'string' && badgeItem[propertyToTestPresenceOf]){
                return classificationTitle;
            }
        }
        logger.error('Badge classification cannot be determined.');
        // else
        throw new Error('Badge classification cannot be determined.');
    }

    static badgeTitle(badge, badgeClassification = null, propMapping = BadgesTabView.classificationMap){
        const badgeItem = badge && badge.item && badge.item.badge;
        if (!badgeClassification){
            badgeClassification = BadgesTabView.badgeClassification(badge, propMapping);
        }
        const inversedPropMapping = _.invert(BadgesTabView.classificationMapAsObject(propMapping));
        return badgeItem[inversedPropMapping[badgeClassification]];
    }

    static sortBadgesFxn(a, b){
        const embedPathA = (a.embedded_path || "a");
        const embedPathB = (b.embedded_path || "b");
        const embedPartsA = embedPathA.split('.');
        const embedPartsB = embedPathB.split('.');
        const parentA = a.parent || 'a';
        const parentB = b.parent || 'b';

        const depthA = embedPartsA.length;
        const depthB = embedPartsB.length;
        const depthDiff = depthA - depthB;

        if (depthDiff !== 0) return depthDiff;

        if (embedPathA !== embedPathB){
            // Same depth, dif path -- try to put them closer together. Should rarely happen.
            if (embedPathA < embedPathB) {
                return -1;
            } else {
                return 1;
            }
        }

        if (parentA !== parentB){
            // Relatively more common. Group items w/ same parent closer together.
            if (parentA < parentB) {
                return -1;
            } else {
                return 1;
            }
        }

        return 0;
    }

    /**
     * Given a context containing aggegated-items/badge, returns a
     * grouping of these badges according to their classification title.
     *
     * @param {Item} context - Item representation with an `aggregated-items` property containing badges.
     */
    static badgesByClassification = memoize(function(context, classificationPropMapping = BadgesTabView.classificationMap){
        const badges = BadgesTabView.getBadgesList(context);
        if (!badges) return null;

        const groupedBadges = _.groupBy(badges, function(badge){ return BadgesTabView.badgeClassification(badge, classificationPropMapping); });

        // Sort (in-place) grouped lists by depth from current/top-level Item
        _.forEach(_.values(groupedBadges), function(badgeGroupList){
            badgeGroupList.sort(BadgesTabView.sortBadgesFxn);
        });

        return groupedBadges;
    });

    render(){
        const { context, schemas } = this.props;
        const badgeList = BadgesTabView.getBadgesList(context);
        const badgeListLen = (badgeList && badgeList.length) || 0;
        const badgesByClassification = BadgesTabView.badgesByClassification(context);
        const badgeClassificationList = _.keys(badgesByClassification);
        const classificationsCount = badgeClassificationList.length;

        if (!badgeListLen) return <h4>No Badges</h4>; // Shouldn't happen unless `#badges` is in URL.

        const body = _.map(
            // We use predefined order for 'groups of badges' (by classification)
            // as defined in `BadgesTabView.classificationMap`.
            _.filter([ ...BadgesTabView.classificationMap.values() ], function(classificationTitle){
                return typeof badgesByClassification[classificationTitle] !== 'undefined';
            }),
            function(badgeClassification){
                const badgesForClassification = badgesByClassification[badgeClassification];
                const badgesLen = badgesForClassification.length;
                const className = "badge-classification-group" + (classificationsCount > 1 ? ' col-lg-6' : '');
                return (
                    <div className={className} data-badge-classification={badgeClassification} key={badgeClassification}>
                        { classificationsCount > 1 ?
                            <h5 className="text-500 mt-0">{ badgesLen + ' ' + badgeClassification + (badgesLen > 1 ? 's' : '') }</h5>
                            : null }
                        { _.map(badgesForClassification, function(badge, idx){
                            const atId = badge && badge.item && badge.item.badge && object.itemUtil.atId(badge.item.badge);
                            const parent = badge && badge.parent;
                            const key = (atId && parent ? parent + " / " + atId : idx);
                            return <BadgeItem {...badge} {...{ context, schemas, key }} />;
                        }) }
                    </div>
                );
            }
        );

        const badgeSingularTitle = classificationsCount > 1 ? "Badge" : badgeClassificationList[0];

        return (
            <div className="overflow-hidden">
                <h3 className="tab-section-title">
                    <span className="text-400">{ badgeListLen }</span>{ " " + badgeSingularTitle + (badgeListLen > 1 ? 's' : '') }
                </h3>
                <hr className="tab-section-title-horiz-divider mb-1"/>
                { classificationsCount > 1 ? <div className="row">{ body }</div> : body }
            </div>
        );
    }
}


/**
 * Given a `context` which represents an Item with aggregated-items/badges,
 * generates a pie chart depicting the ratio(s) of different types classification
 */
class SummaryIcon extends React.PureComponent {

    static getClassificationRatios = memoize(function(context, classificationPropMapping = BadgesTabView.propMapping){
        const badgesGroupedByClassification = BadgesTabView.badgesByClassification(context, classificationPropMapping);
        if (!badgesGroupedByClassification) return null;

        const badgeClassifications = _.keys(badgesGroupedByClassification);
        const badgeClassificationsLen = badgeClassifications.length;
        const classificationRatios = {};
        var i, currClassification, totalBadges = 0;

        for (i = 0; i < badgeClassificationsLen; i++){
            currClassification = badgeClassifications[i];
            totalBadges += badgesGroupedByClassification[currClassification].length;
        }

        for (i = 0; i < badgeClassificationsLen; i++){
            currClassification = badgeClassifications[i];
            classificationRatios[currClassification] = badgesGroupedByClassification[currClassification].length / totalBadges;
        }

        return classificationRatios;
    });

    static defaultProps = {
        'size' : 20,
        'innerRadius' : 3,
        'classificationColorMap' : {
            "Commendation"  : '#e5ca75',
            "Warning"       : '#d46200'
        },
        'classificationSingleItemMap' : {
            "Commendation" : function commendationBadge(props){
                const { size, context } = props;
                const badgesByClassification = BadgesTabView.badgesByClassification(context);
                // We know implicitly that only 1 classification exists here.
                const countCommendations = badgesByClassification.Commendation.length;
                const tooltip = countCommendations + " Commendation" + (countCommendations > 1 ? "s" : "");
                return (
                    <div className="d-inline-block pie-chart-icon-container mr-08" data-tip={tooltip}>
                        <svg height={size} width={size} style={{ verticalAlign : 'middle' }}>
                            <EmbeddableSVGBadgeIcon badgeType="gold" size={size} />
                        </svg>
                    </div>
                );
            },
            "Warning" : function warningBadge(props){
                const { context } = props;
                const badgesByClassification = BadgesTabView.badgesByClassification(context);
                // We know implicitly that only 1 classification exists here.
                const countWarnings = badgesByClassification.Warning.length;
                const tooltip = countWarnings + " Warning" + (countWarnings > 1 ? "s" : "");
                return (
                    <span className="active">
                        <i className="icon icon-fw icon-exclamation-triangle fas" data-tip={tooltip}/>
                    </span>
                );
            }
        }
    };

    constructor(props){
        super(props);
        _.bindAll(this, 'generateArcs', 'generatePieChart');
        this.generateArcs = memoize(this.generateArcs);
        this.pieGenerator = pie();
    }

    generateArcs(classificationRatioPairs){ // memoized in constructor
        const { innerRadius, classificationColorMap, size } = this.props;
        const outerRadius = size / 2;
        const pieChartDims = this.pieGenerator(  _.pluck(classificationRatioPairs, 1)   );
        const arcGenerator = arc().innerRadius(innerRadius).outerRadius(outerRadius);
        return _.map(classificationRatioPairs, function([ classificationTitle, classificationRatio ], idx){
            return (
                <path d={arcGenerator(pieChartDims[idx])} className={"path-for-" + classificationTitle}
                    style={{ 'fill' : classificationColorMap[classificationTitle] || '#ccc' }} />
            );
        });
    }

    generatePieChart(classificationRatioPairs){
        const { size, context } = this.props;
        const badgesByClassification = BadgesTabView.badgesByClassification(context);

        const outerRadius = size / 2;
        const tooltip = _.map(classificationRatioPairs, function([ classificationTitle, classificationRatio ]){
            const badgesForClassificationLen = badgesByClassification[classificationTitle].length;
            return badgesForClassificationLen + " " + classificationTitle + (badgesForClassificationLen > 1 ? 's' : '');
        }).join(' + ');

        return (
            <div className="d-inline-block pie-chart-icon-container mr-08" data-tip={tooltip}>
                <svg width={size} height={size} style={{ verticalAlign : 'middle' }}>
                    <g transform={"translate(" + outerRadius + "," + outerRadius + ")"}>{ this.generateArcs(classificationRatioPairs) }</g>
                </svg>
            </div>
        );
    }

    render(){
        const { context, classificationSingleItemMap } = this.props;
        const classificationRatios = SummaryIcon.getClassificationRatios(context);
        const classificationRatioPairs = _.pairs(classificationRatios);

        if (!classificationRatios){
            // Shouldn't happen unless BadgesTabView is present on Item w/o any badges.
            return <i className="icon icon-fw icon-circle far"/>; // Todo: maybe different icon
        }

        if (classificationRatioPairs.length === 1){
            const [ [ singleClassificationTitle ] ] = classificationRatioPairs;
            if (singleClassificationTitle && classificationSingleItemMap && classificationSingleItemMap[singleClassificationTitle]){
                return classificationSingleItemMap[singleClassificationTitle](this.props);
            }
        }

        return this.generatePieChart(classificationRatioPairs);
    }

}


class BadgeItem extends React.PureComponent {

    /**
     * Function to get/find the embedded Item to which this badge applies.
     *
     * @param {string|string[]} embedded_path - Path to the embedded item / parent ID either as dot-delimited string or array (must not have 'badges').
     * @param {string} parentID - The @id of the parent Item to which badge belongs to.
     * @param {Item} context - The root Item from which we grab the emebdded Item.
     * @returns {Item|null} Embedded Item to which Badge with embedded_path and parentID belongs to, or null if not found / no view permissions.
     */
    static getParent(embedded_path, parentID, context){
        // "badges" is implicitly the last item of each `embedded_path` so we clear it out
        const embedPath = (
            Array.isArray(embedded_path) ? embedded_path.slice(0) // Assume has been called recursively, without 'badges' already.
                : _.without(embedded_path.split('.'), "badges")
        );

        if (embedPath.length === 0) {
            // Badge is on root context item itself.
            if (object.itemUtil.atId(context) === parentID){
                return context;
            } else {
                return null;
            }
        }

        var currEmbedItem = context,
            currEmbedProperty, arrIdx, arrRes;

        while (embedPath.length > 0){
            currEmbedProperty = embedPath.shift();
            currEmbedItem = currEmbedItem[currEmbedProperty];
            if (Array.isArray(currEmbedItem)){
                // It's likely that the same Item is embedded for multiple Items.
                // We should return ASAP and not dig into _every_ one.
                for (arrIdx = 0; arrIdx < currEmbedItem.length; arrIdx++){
                    arrRes = BadgeItem.getParent(embedPath, parentID, currEmbedItem[arrIdx]);
                    if (arrRes && object.itemUtil.atId(arrRes) === parentID){
                        return arrRes;
                    }
                }
                return null; // Not found (likely no view permission)
            }
        }

        return currEmbedItem;
    }

    constructor(props){
        super(props);
        this.getParent = memoize(BadgeItem.getParent);
    }

    render(){
        const { item, parent : parentID, embedded_path, context, schemas } = this.props;
        const { messages, badge } = item;
        const { badge_icon, description } = badge;
        const classification = BadgesTabView.badgeClassification(this.props);
        const badgeTitle = BadgesTabView.badgeTitle(this.props, classification);

        let linkMsg = null;

        if (parentID && object.itemUtil.atId(context) !== parentID){
            let titleToShow = "Item";
            let tooltip = "Click to visit item containing badge.";
            const parentItem = this.getParent(embedded_path, parentID, context);
            const parentTypeTitle = parentItem && schemaTransforms.getItemTypeTitle(parentItem, schemas);
            const parentDisplayTitle = parentItem && parentItem.display_title;
            if (parentTypeTitle && parentDisplayTitle){ // These two props are default embeds. If not present is most likely due to lack of view permissions.
                titleToShow = <React.Fragment>{ parentTypeTitle } <span className="text-600">{ parentDisplayTitle }</span></React.Fragment>;
                tooltip = parentItem.description || tooltip;
            }
            linkMsg = <div className="mt-02"><a href={parentID} data-tip={tooltip}>View { titleToShow }</a></div>;
        }

        const image = badge_icon && (<div className="text-center icon-container"><img src={badge_icon} /></div>);

        let renderedMessages = null;

        if (Array.isArray(messages) && messages.length > 0){
            if (messages.length === 1){
                renderedMessages = <p className="mb-0 mt-0">{ messages[0] }</p>;
            } else {
                renderedMessages = (
                    <ul className="mb-0 mt-01 messages-list">
                        { _.map(messages, function(msg, i){ return <li key={i}>{ msg }</li>; }) }
                    </ul>
                );
            }
        }

        return (
            <div className="badge-item">
                <div className="row flexrow">
                    <div className="col-12 col-sm-2 icon-col">{ image }</div>
                    <div className="col-12 col-sm-10 title-col">
                        <div className="inner mb-05">
                            <h4 className="text-500 mb-0 mt-0">
                                { badgeTitle }
                                { description ? <i className="icon icon-fw icon-info-circle fas ml-05" data-tip={description} /> : null }
                            </h4>
                            { renderedMessages }
                            { linkMsg }
                        </div>
                    </div>
                </div>
            </div>
        );

    }

}


export class EmbeddableSVGBadgeIcon extends React.PureComponent {

    static linearGradientDefinition(type = "gold"){ // TODO: Implement other colors/types

        if (type === 'gold-deprecated'){
            // Gold variant 1 - light streak in center
            return (
                <linearGradient
                    id="embeddable_badge_svg_gradient_definition"
                    spreadMethod="pad"
                    gradientTransform="matrix(-63.389961,63.389961,63.389961,63.389961,84.548042,23.789524)"
                    gradientUnits="userSpaceOnUse"
                    y2="0"
                    x2="1"
                    y1="0"
                    x1="0">
                    <stop offset="0" style={{ stopOpacity: 1, stopColor: "#dbba67" }}/>
                    <stop offset="0.514543" style={{ stopOpacity: 1, stopColor: "#f8e78f" }} />
                    <stop offset="1" style={{ stopOpacity: 1, stopColor: "#e0c26e" }} />
                </linearGradient>
            );
        }

        if (type === 'gold'){
            // Gold variant 2 - light streak near top
            return (
                <linearGradient x1="0" y1="0" x2="1" y2="0"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="matrix(-84.350783,-86.777598,84.350783,-86.777598,104.17548,105.38879)"
                    spreadMethod="pad"
                    id="embeddable_badge_svg_gradient_definition">
                    <stop offset="0" style={{ stopOpacity: 1, stopColor: "#d29a11" }} />
                    <stop offset="0.336498" style={{ stopOpacity: 1, stopColor: "#dcae3c" }} />
                    <stop offset="1" style={{ stopOpacity: 1, stopColor: "#eed781" }}  />
                </linearGradient>
            );
        }

    }

    static ribbons(color = "#081ebb"){
        const style = { fill : color, fillOpacity: 1, fillRule: "nonzero", stroke: "none" };
        return (
            <g transform="matrix(1.3333333, 0, 0, -1.3333333, -1, 130)">
                <g transform="translate(-6.8762048,-4.9273304)">
                    <path d="m 26.7374,12.0591 23.046,28.77 -15.008,12.022 -23.469,-29.297" style={style} />
                    <path d="m 18.1642,25.7154 11.924,-9.368 -9.368,-11.923" style={style} />
                    <path d="m 5.5362,16.3135 9.492,11.824 11.824,-9.492" style={style} />
                </g>
                <g transform="translate(-6.8762048,-4.9273304)">
                    <path d="m 95.7296,22.6348 -21.179,30.171 -15.738,-11.047 21.565,-30.725" style={style} />
                    <path d="m 80.2208,18.2227 12.328,8.828 8.828,-12.328" style={style} />
                    <path d="m 85.7169,3.4693 -8.698,12.42 12.419,8.698" style={style} />
                </g>
            </g>
        );
    }

    static defaultProps = {
        'size' : 20,
        'badgeType' : 'gold',
        'ribbons' : true,
        'innerCircleStrokeWidth' : 3
    };

    render(){
        var { size, badgeType, ribbons, innerCircleStrokeWidth } = this.props,
            origSize = 132,
            scale = size / origSize;

        return (
            <g transform={"scale(" + scale + ")"}>
                <defs>{ EmbeddableSVGBadgeIcon.linearGradientDefinition(badgeType) }</defs>
                { ribbons && EmbeddableSVGBadgeIcon.ribbons() }
                <path
                    style={{ 'fill' : "url(#embeddable_badge_svg_gradient_definition)" }}
                    d="m 122.5,62.000686 -8.69589,10.399902 3.96006,13.102207 -12.0026,5.99052 -1.34796,13.651155 -13.321286,0.78304 -6.2661,12.11793 L 72.188901,113.6388 62.000001,122.5 51.812433,113.6388 39.17511,118.04544 32.907679,105.92751 19.586395,105.1431 18.238432,91.491946 6.2358359,85.502795 10.195894,72.400588 1.5000002,62.000686 10.195894,51.598045 6.2358359,38.497207 18.239762,32.508057 19.587726,18.855533 32.90901,18.072494 39.173779,5.9545612 51.812433,10.361207 62.000001,1.5000025 l 10.1889,8.8612045 12.637323,-4.4066458 6.2661,12.1179328 13.321286,0.784408 1.34796,13.651155 12.0026,5.990519 -3.96006,13.099469 z"
                />
                <path
                    d="m 105.10525,59.047919 c 1.632,23.806666 -16.346662,44.428001 -40.151994,46.057331 -23.808,1.632 -44.429333,-16.345332 -46.058666,-40.151998 -1.630667,-23.808 16.346666,-44.427999 40.153332,-46.058666 23.806666,-1.630666 44.426668,16.346667 46.057328,40.153333 z"
                    style={{
                        "fill" : "none", "stroke" : "#fff", "strokeWidth" : innerCircleStrokeWidth, "strokeLinecap" : "butt",
                        "strokeLinejoin" : "miter", "strokeMiterlimit" : 10, "strokeDasharray" : "none",
                        "strokeOpacity" : 1
                    }}/>
            </g>
        );
    }
}
