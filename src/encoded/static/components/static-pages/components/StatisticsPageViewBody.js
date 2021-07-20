'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { stringify } from 'query-string';
import * as d3 from 'd3';
import moment from 'moment';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';

import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { console, ajax, analytics, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { navigate } from './../../util';
import {
    StatsViewController, GroupByDropdown, ColorScaleProvider,
    AreaChart, AreaChartContainer, LoadingIcon, ErrorIcon, HorizontalD3ScaleLegend,
    StatsChartViewAggregator, GroupByController
} from './../../viz/AreaChart';

/**
 * @module
 * We export out most things needed for /statistics/ page view out of here to
 * make code-splitting of this easier. Isn't a primary page of portal so we defer
 * its loading until if needed. Also deprioritized in terms of cleanup (of which much
 * could be done).
 */

export { StatsChartViewAggregator, GroupByController };


export const commonParsingFxn = {
    /**
     * MODIFIES OBJECTS IN PLACE
     */
    'countsToTotals' : function(parsedBuckets, excludeChildren = false){
        let total = 0;
        const subTotals = {};

        parsedBuckets.forEach(function(bkt, index){
            total += bkt.count;
            bkt.total = total;
            if (excludeChildren || !Array.isArray(bkt.children)) return;

            bkt.children.forEach(function(c){
                c.total = subTotals[c.term] = (subTotals[c.term] || 0) + (c.count || 0);
            });
        });

        return parsedBuckets;
    },
    /**
     * Doesn't add up totals, just renames 'count' property to 'total' property.
     * MODIFIES IN PLACE.
     */
    'countsToCountTotals' : function(parsedBuckets, excludeChildren = false){
        parsedBuckets.forEach(function(bkt){
            bkt.total = bkt.count;
            bkt.children.forEach(function(c){
                c.total = c.count;
            });
        });
        return parsedBuckets;
    },
    /**
     * MODIFIES OBJECTS IN PLACE
     */
    'fillMissingChildBuckets' : function(aggsList, subAggTerms = [], externalTermMap = {}){
        aggsList.forEach(function(datum){
            subAggTerms.forEach(function(term){
                if (externalTermMap && externalTermMap[term]) return;
                if (!_.findWhere(datum.children, { term })){
                    datum.children.push({ term, 'count' : 0, 'total' : 0, 'date' : datum.date });
                }
            });
        });

        const today = new Date();
        const lastDate = aggsList.length > 0 && new Date(aggsList[aggsList.length - 1].date);
        const todayAsString = today.toISOString().slice(0,10);

        if (lastDate && lastDate < today){
            aggsList.push({
                ...aggsList[aggsList.length - 1],
                'date' : todayAsString,
                'count' : 0,
                'children' : aggsList[aggsList.length - 1].children.map(function(c){
                    return _.extend({}, c, { 'date' : todayAsString, 'count' : 0 });
                })
            });
        }
    },
    /**
     * Converts date_histogram, histogram, or range aggregations from ElasticSearch result into similar but simpler bucket structure.
     * Sets 'count' to be 'doc_count' value from histogram.
     *
     * @param {{ key_as_string: string, doc_count: number, group_by?: { buckets: { doc_count: number, key: string  }[] } }[]} intervalBuckets - Raw aggregation results returned from ElasticSearch
     * @param {Object.<string>} [externalTermMap] - Object which maps external terms to true (external data) or false (internal data).
     * @param {boolean} [excludeChildren=false] - If true, skips aggregating up children to increase performance very slightly.
     */
    'bucketDocCounts' : function(intervalBuckets, groupByField, externalTermMap, excludeChildren = false){
        const subBucketKeysToDate = new Set();
        const aggsList = intervalBuckets.map(function(bucket, index){
            const {
                doc_count,
                key_as_string,
                [groupByField] : { buckets: subBuckets = [] } = {}
            } = bucket;

            if (excludeChildren === true){
                return {
                    'date' : key_as_string.split('T')[0], // Sometimes we get a time back with date when 0 doc_count; correct it to date only.
                    'count' : doc_count
                };
            } else {
                _.pluck(subBuckets, 'key').forEach(function(k){
                    subBucketKeysToDate.add(k);
                });

                const children = [ ...subBucketKeysToDate ].map(function(term){
                    // Create a parsed 'bucket' even if none returned from ElasticSearch agg but it has appeared earlier.
                    const subBucket = _.findWhere(subBuckets, { 'key' : term });
                    const count = ((subBucket && subBucket.doc_count) || 0);

                    return { term, count };
                });

                return {
                    'date' : key_as_string.split('T')[0], // Sometimes we get a time back with date when 0 doc_count; correct it to date only.
                    'count' : doc_count,
                    'children' : groupExternalChildren(children, externalTermMap)
                };
            }
        });

        if (subBucketKeysToDate.size === 0){ // No group by defined, fill with dummy child for each.
            _.forEach(aggsList, function(dateBucket){
                dateBucket.children = [{ term : null, count : dateBucket.count }];
            });
            subBucketKeysToDate.add(null);
        }

        // Ensure each datum has all child terms, even if blank.
        commonParsingFxn.fillMissingChildBuckets(aggsList, _.difference([ ...subBucketKeysToDate ], (externalTermMap && _.keys(externalTermMap)) || [] ));

        return aggsList;
    },
    /**
     * Converts date_histogram, histogram, or range aggregations from ElasticSearch result into similar but simpler bucket structure.
     * Sets 'count' to be 'bucket.total_files.value' value from histogram.
     *
     * @param {{ key_as_string: string, doc_count: number, group_by?: { buckets: { doc_count: number, key: string  }[] } }[]} intervalBuckets - Raw aggregation results returned from ElasticSearch
     * @param {Object.<string>} [externalTermMap] - Object which maps external terms to true (external data) or false (internal data).
     */
    'bucketTotalFilesCounts' : function(intervalBuckets, groupByField, externalTermMap){
        const subBucketKeysToDate = new Set();
        const aggsList = intervalBuckets.map(function(bucket, index){
            const {
                key_as_string,
                total_files : { value: totalFiles = 0 } = {},
                [groupByField] : { buckets: subBuckets = [] } = {}
            } = bucket;

            _.pluck(subBuckets, 'key').forEach(function(k){
                subBucketKeysToDate.add(k);
            });

            const children = [ ...subBucketKeysToDate ].map(function(term){
                const subBucket = _.findWhere(subBuckets, { 'key' : term });
                const count = ((subBucket && subBucket.total_files && subBucket.total_files.value) || 0);

                return { term, count };
            });

            return {
                'date' : key_as_string.split('T')[0], // Sometimes we get a time back with date when 0 doc_count; correct it to date only.
                'count' : totalFiles,
                'children' : groupExternalChildren(children, externalTermMap)
            };
        });

        // Ensure each datum has all child terms, even if blank.
        commonParsingFxn.fillMissingChildBuckets(aggsList, _.difference([ ...subBucketKeysToDate ], (externalTermMap && _.keys(externalTermMap)) || [] ));

        return aggsList;
    },
    'bucketTotalFilesVolume' : function(intervalBuckets, groupByField, externalTermMap){
        const gigabyte = 1024 * 1024 * 1024;
        const subBucketKeysToDate = new Set();
        const aggsList = intervalBuckets.map(function(bucket, index){
            const {
                key_as_string,
                total_files_volume : { value: totalFilesVolume = 0 } = {},
                [groupByField] : { buckets: subBuckets = [] } = {}
            } = bucket;

            _.pluck(subBuckets, 'key').forEach(function(k){
                subBucketKeysToDate.add(k);
            });

            const fileSizeVol = totalFilesVolume / gigabyte;
            const children = [ ...subBucketKeysToDate ].map(function(term){
                const subBucket = _.findWhere(subBuckets, { 'key' : term });
                const subFileSizeVol = ((subBucket && subBucket.total_files_volume && subBucket.total_files_volume.value) || 0) / gigabyte;

                return { term, 'count' : subFileSizeVol };
            });

            return {
                'date'     : key_as_string.split('T')[0], // Sometimes we get a time back with date when 0 doc_count; correct it to date only.
                'count'    : fileSizeVol,
                'children' : groupExternalChildren(children, externalTermMap)
            };
        });

        // Ensure each datum has all child terms, even if blank.
        commonParsingFxn.fillMissingChildBuckets(aggsList, _.difference(Array.from(subBucketKeysToDate), (externalTermMap && _.keys(externalTermMap)) || [] ));

        return aggsList;
    },
    'analytics_to_buckets' : function(resp, reportName, termBucketField, countKey){
        const subBucketKeysToDate = new Set();

        // De-dupe -- not particularly necessary as D3 handles this, however nice to have well-formatted data.
        const trackingItems = _.uniq(resp['@graph'], true, function(trackingItem){
            return trackingItem.google_analytics.for_date;
        });

        // Notably, we do NOT sum up total here.
        const aggsList = trackingItems.map(function(trackingItem, index, allTrackingItems){
            const { google_analytics : {
                reports : {
                    [reportName] : currentReport = []
                }, // `currentReport` => List of JSON objects (report entries, 1 per unique dimension value)
                for_date
            } } = trackingItem;

            const totalSessions = _.reduce(currentReport, function(sum, trackingItemItem){
                return sum + trackingItemItem[countKey];
            }, 0);

            const currItem = {
                'date'      : trackingItem.google_analytics.for_date,
                'count'     : totalSessions,
                'total'     : totalSessions,
                'children'  : currentReport.map(function(reportEntry){
                    const term = typeof termBucketField === 'function' ? termBucketField(reportEntry) : reportEntry[termBucketField];
                    subBucketKeysToDate.add(term);
                    return {
                        'term'      : term,
                        'count'     : reportEntry[countKey],
                        'total'     : reportEntry[countKey],
                        'date'      : for_date
                    };
                })
            };

            // Unique-fy
            currItem.children = _.values(_.reduce(currItem.children || [], function(memo, child){
                if (memo[child.term]) {
                    memo[child.term].count += child.count;
                    memo[child.term].total += child.total;
                } else {
                    memo[child.term] = child;
                }
                return memo;
            }, {}));

            return currItem;

        }).reverse(); // We get these in decrementing order from back-end

        commonParsingFxn.fillMissingChildBuckets(aggsList, Array.from(subBucketKeysToDate));

        return aggsList;
    }
};

const aggregationsToChartData = {
    'expsets_released' : {
        'requires'  : 'ExperimentSetReplicate',
        'function'  : function(resp, props){
            if (!resp || !resp.aggregations) return null;
            const { aggregations : {
                weekly_interval_public_release : { buckets: publicBuckets = [] } = {}
            } } = resp;

            if (publicBuckets.length < 2) return null;

            return commonParsingFxn.countsToTotals(
                commonParsingFxn.bucketDocCounts(publicBuckets, props.currentGroupBy, props.externalTermMap)
            );
        }
    },
    'expsets_released_internal' : {
        'requires'  : 'ExperimentSetReplicate',
        'function'  : function(resp, props){
            if (!resp || !resp.aggregations) return null;
            const { aggregations : {
                weekly_interval_project_release : { buckets: internalBuckets = [] } = {}
            } } = resp;

            if (internalBuckets.length < 2) return null;

            return commonParsingFxn.countsToTotals(
                commonParsingFxn.bucketDocCounts(internalBuckets, props.currentGroupBy, props.externalTermMap)
            );
        }
    },
    'expsets_released_vs_internal' : {
        'requires' : 'ExperimentSetReplicate',
        'function'  : function(resp, props){
            if (!resp || !resp.aggregations) return null;

            const { aggregations : {
                weekly_interval_project_release : { buckets: internalBuckets = [] } = {},
                weekly_interval_public_release : { buckets: publicBuckets = [] } = {}
            } } = resp;

            if (internalBuckets.length < 2) return null;
            if (publicBuckets.length < 2) return null;

            function makeDatePairFxn(bkt){ return [ bkt.date, bkt ]; }

            const internalList        = commonParsingFxn.bucketDocCounts(internalBuckets, props.externalTermMap, true);
            const publicList          = commonParsingFxn.bucketDocCounts(publicBuckets,   props.externalTermMap, true);
            const allDates            = _.uniq(_.pluck(internalList, 'date').concat(_.pluck(publicList, 'date'))).sort(); // Used as keys to zip up the non-index-aligned lists.
            const internalKeyedByDate = _.object(internalList.map(makeDatePairFxn));
            const publicKeyedByDate   = _.object(publicList.map(makeDatePairFxn));
            const combinedAggList     = allDates.map(function(dateString){
                const internalBucket = internalKeyedByDate[dateString] || null;
                const publicBucket = publicKeyedByDate[dateString] || null;
                const comboBucket = {
                    'date' : dateString,
                    'count' : 0,
                    'children' : [
                        { 'term' : 'Internally Released', 'count' : 0 }, // We'll fill these counts up shortly
                        { 'term' : 'Publicly Released', 'count' : 0 }
                    ]
                };

                if (internalBucket){
                    comboBucket.children[0].count = comboBucket.count = internalBucket.count; // Use as outer bucket count/bound, also
                }
                if (publicBucket){
                    comboBucket.children[1].count = publicBucket.count;
                }
                return comboBucket;
            });

            commonParsingFxn.countsToTotals(combinedAggList);
            combinedAggList.forEach(function(comboBucket){ // Calculate diff from totals-to-date.
                if (comboBucket.total < comboBucket.children[1].total){
                    // TODO: Trigger an e-mail alert to wranglers from Sentry UI if below exception occurs.
                    logger.error("StatisticsPage: Public release total is higher than project release total at date " + comboBucket.date, comboBucket);
                }
                comboBucket.children[0].total -= comboBucket.children[1].total;
            });
            return combinedAggList;
        }
    },
    'files_released' : {
        'requires'  : 'ExperimentSetReplicate',
        'function'  : function(resp, props){
            if (!resp || !resp.aggregations) return null;
            var weeklyIntervalBuckets = resp && resp.aggregations && resp.aggregations.weekly_interval_public_release && resp.aggregations.weekly_interval_public_release.buckets;
            if (!Array.isArray(weeklyIntervalBuckets) || weeklyIntervalBuckets.length < 2) return null;

            return commonParsingFxn.countsToTotals(
                commonParsingFxn.bucketTotalFilesCounts(weeklyIntervalBuckets, props.currentGroupBy, props.externalTermMap)
            );
        }
    },
    'file_volume_released' : {
        'requires'  : 'ExperimentSetReplicate',
        'function'  : function(resp, props){
            if (!resp || !resp.aggregations) return null;
            var weeklyIntervalBuckets = resp.aggregations.weekly_interval_public_release && resp.aggregations.weekly_interval_public_release.buckets;
            if (!Array.isArray(weeklyIntervalBuckets) || weeklyIntervalBuckets.length < 2) return null;

            return commonParsingFxn.countsToTotals(
                commonParsingFxn.bucketTotalFilesVolume(weeklyIntervalBuckets, props.currentGroupBy, props.externalTermMap)
            );
        }
    },
    'fields_faceted' : {
        'requires' : 'TrackingItem',
        'function' : function(resp, props){
            if (!resp || !resp['@graph']) return null;

            var countKey    = 'ga:totalEvents',
                groupingKey = "ga:dimension3"; // Field name, dot notation

            if (props.countBy.fields_faceted === 'sessions') countKey = 'ga:sessions';
            if (props.fields_faceted_group_by === 'term') groupingKey = 'ga:dimension4';
            if (props.fields_faceted_group_by === 'field+term') groupingKey = 'ga:eventLabel';

            return commonParsingFxn.analytics_to_buckets(resp, 'fields_faceted', groupingKey, countKey);
        }
    },
    'sessions_by_country' : {
        'requires' : 'TrackingItem',
        'function' : function(resp, props){
            if (!resp || !resp['@graph']) return null;

            var countKey = 'ga:pageviews';
            if (props.countBy.sessions_by_country === 'sessions') countKey = 'ga:sessions';

            return commonParsingFxn.analytics_to_buckets(resp, 'sessions_by_country', 'ga:country', countKey);
        }
    },
    /*
    'browse_search_queries' : {
        'requires' : 'TrackingItem',
        'function' : function(resp, props){
            if (!resp || !resp['@graph']) return null;

            var countKey = 'ga:pageviews';
            if (props.currentGroupBy === 'sessions') countKey = 'ga:users'; // "Sessions" not saved in analytics for search queries.

            return commonParsingFxn.analytics_to_buckets(resp, 'browse_search_queries', 'ga:searchKeyword', countKey);
        }
    },
    'other_search_queries' : {
        'requires' : 'TrackingItem',
        'function' : function(resp, props){
            if (!resp || !resp['@graph']) return null;

            var countKey = 'ga:pageviews';
            if (props.currentGroupBy === 'sessions') countKey = 'ga:users'; // "Sessions" not saved in analytics for search queries.

            return commonParsingFxn.analytics_to_buckets(resp, 'search_search_queries', 'ga:searchKeyword', countKey);
        }
    },
    */
    'experiment_set_views' : {
        'requires' : 'TrackingItem',
        'function' : function(resp, props){
            if (!resp || !resp['@graph']) return null;

            //var termBucketField = function(subBucket){ return subBucket['ga:productBrand'] + ' - ' + subBucket['ga:productName']; };
            const termBucketField = 'ga:productBrand';
            let countKey = 'ga:productDetailViews';

            if (props.countBy.experiment_set_views === 'list_views') countKey = 'ga:productListViews';
            else if (props.countBy.experiment_set_views === 'clicks') countKey = 'ga:productListClicks';

            return commonParsingFxn.analytics_to_buckets(resp, 'views_by_experiment_set', termBucketField, countKey);
        }
    },
    /**
     * For this function, props.currentGroupBy is the interval or time duration, not the actual 'group by' as it is for submissions.
     * Instead, `props.countBy.file_downloads` is used similar to the google analytics approach.
     */
    'file_downloads' : {
        'requires'  : "TrackingItem", //'TrackingItemDownload',
        'function'  : function(resp, props){
            if (!resp || !resp['@graph']) return null;
            const { countBy : { file_downloads : countBy } } = props;

            let useReport = 'file_downloads_by_experiment_type';
            let groupingKey = "ga:dimension5"; // Experiment Type
            const countKey = 'ga:metric2'; // Download Count

            if (countBy === 'filetype'){
                useReport = 'file_downloads_by_filetype';
                groupingKey = 'ga:productVariant'; // File Type
            } else if (countBy === 'geo_country'){
                useReport = 'file_downloads_by_country';
                groupingKey = 'ga:country';
            }

            console.log("AGGR", resp, props, countBy, groupingKey, useReport);

            //if (props.file_downloads_by_experiment_type_group_by === 'term') groupingKey = 'ga:dimension4';
            //if (props.file_downloads_by_experiment_type_group_by === 'field+term') groupingKey = 'ga:eventLabel';

            return commonParsingFxn.analytics_to_buckets(resp, useReport, groupingKey, countKey);

            // if (!resp || !resp.aggregations || !props.countBy || !props.countBy.file_downloads) return null;
            // const dateAggBucket = props.currentGroupBy && (props.currentGroupBy + '_interval_date_created');
            // const dateIntervalBuckets = resp && resp.aggregations && resp.aggregations[dateAggBucket] && resp.aggregations[dateAggBucket].buckets;

            // if (!Array.isArray(dateIntervalBuckets) || dateIntervalBuckets.length < 2) return null;

            // return commonParsingFxn.countsToCountTotals(
            //     commonParsingFxn.bucketDocCounts(dateIntervalBuckets, props.countBy.file_downloads)
            // );
        }
    },
};

// I forgot what purpose of all this was, kept because no time to refactor all now.
export const submissionsAggsToChartData = _.pick(aggregationsToChartData,
    'expsets_released', 'expsets_released_internal',
    'expsets_released_vs_internal', 'files_released',
    'file_volume_released'
);

export const usageAggsToChartData = _.pick(aggregationsToChartData,
    'sessions_by_country', 'fields_faceted', 'experiment_set_views', 'file_downloads'
);


export class UsageStatsViewController extends React.PureComponent {

    static getSearchReqMomentsForTimePeriod(currentGroupBy = "daily"){
        const untilDate = moment.utc();
        let fromDate;
        if (currentGroupBy === 'monthly'){ // 1 yr (12 mths)
            untilDate.startOf('month').subtract(1, 'minute'); // Last minute of previous month
            fromDate = untilDate.clone();
            fromDate.subtract(12, 'month'); // Go back 12 months
        } else if (currentGroupBy === 'daily'){ // 30 days
            untilDate.subtract(1, 'day');
            fromDate = untilDate.clone();
            fromDate.subtract(30, 'day'); // Go back 30 days
        }
        return { fromDate, untilDate };
    }

    static defaultProps = {
        'searchURIs' : {
            'TrackingItem' : function(props) {
                const { currentGroupBy, href } = props;
                const { fromDate, untilDate } = UsageStatsViewController.getSearchReqMomentsForTimePeriod(currentGroupBy);


                const report_names = [
                    // Reduce size of response a little bit (dl'd size is in range of 2-3 mb)
                    "fields_faceted",
                    "sessions_by_country",
                    "file_downloads_by_experiment_type",
                    "file_downloads_by_filetype",
                    "file_downloads_by_country",
                    "views_by_file",
                    "views_by_experiment_set",
                    "for_date"
                ];

                let uri = '/search/?type=TrackingItem&tracking_type=google_analytics&sort=-google_analytics.for_date&format=json';

                uri += '&limit=all&google_analytics.date_increment=' + currentGroupBy;
                uri += '&google_analytics.for_date.from=' + fromDate.format('YYYY-MM-DD') + '&google_analytics.for_date.to=' + untilDate.format('YYYY-MM-DD');
                uri += "&" + report_names.map(function(n){ return "field=google_analytics.reports." + encodeURIComponent(n); }).join("&");
                uri += "&field=google_analytics.for_date";

                // For simpler testing & debugging -- if on localhost, connects to data.4dn by default.
                // if (href && href.indexOf('http://localhost') > -1){
                //     uri = 'https://data.4dnucleome.org' + uri;
                // }
                return uri;
            }
        },

        /**
         * Return a boolean to determine whether to refetch (all) aggs from ES.
         *
         * @returns {boolean}
         */
        'shouldRefetchAggs' : function(pastProps, nextProps){
            return StatsViewController.defaultProps.shouldRefetchAggs(pastProps, nextProps) || (
                pastProps.currentGroupBy !== nextProps.currentGroupBy
            );
        }
    };

    constructor(props){
        super(props);
        this.changeCountByForChart = this.changeCountByForChart.bind(this);

        const countBy = {};

        Object.keys(usageAggsToChartData).forEach(function(k){
            if (k === 'file_downloads'){
                countBy[k] = 'experiment_type'; // For file_downloads, countBy is treated as 'groupBy'.
                // Not high enough priority to spend much time improving this file, albeit much straightforward room for it exists.
            } else {
                countBy[k] = 'views';
            }
        });

        this.state = { countBy }; // aka include range queries for download tracking
    }

    changeCountByForChart(chartID, nextCountBy){
        setTimeout(()=>{
            // This might take some noticeable amount of time (not enough to justify a worker, tho) so we defer/deprioritize its execution to prevent blocking UI thread.
            this.setState(({ countBy: prevCountBy })=>{
                const countBy = _.clone(prevCountBy);
                countBy[chartID] = nextCountBy;
                return { countBy };
            });
        }, 0);
    }

    render(){
        return <StatsViewController {...this.props} {...this.state} changeCountByForChart={this.changeCountByForChart}/>;
    }
}




export class SubmissionStatsViewController extends React.PureComponent {

    static defaultProps = {
        'searchURIs' : {
            'ExperimentSetReplicate' : function(props) {
                const params = navigate.getBrowseBaseParams(props.browseBaseState || null);
                if (props.currentGroupBy){
                    params.group_by = props.currentGroupBy;
                }
                //if (props.browseBaseState === 'all') params['group_by'] = ['award.project'];
                const uri = '/date_histogram_aggregations/?' + stringify(params) + '&limit=0&format=json';

                // For local dev/debugging; don't forget to comment out if using.
                //uri = 'https://data.4dnucleome.org' + uri;
                return uri;
            }
        },
        'shouldRefetchAggs' : function(pastProps, nextProps){
            return StatsViewController.defaultProps.shouldRefetchAggs(pastProps, nextProps) || (
                pastProps.browseBaseState !== nextProps.browseBaseState ||
                pastProps.currentGroupBy  !== nextProps.currentGroupBy
            );
        }
    };

    constructor(props){
        super(props);
        this.fetchAndGenerateExternalTermMap = this.fetchAndGenerateExternalTermMap.bind(this);
        this.state = { "externalTermMap" : null };
    }

    componentDidMount(){
        this.fetchAndGenerateExternalTermMap();
    }

    componentDidUpdate(pastProps){
        const { shouldRefetchAggs, session } = this.props;
        if (shouldRefetchAggs(pastProps, this.props)){
            if (pastProps.session !== session){
                // Avoid triggering extra re-aggregation from new/unnecessary term map being loaded.
                this.fetchAndGenerateExternalTermMap(true);
            }
        }
    }

    fetchAndGenerateExternalTermMap(refresh = false){
        const { externalTermMap } = this.state;
        if (!refresh && externalTermMap && _.keys(externalTermMap).length > 0) return;

        ajax.load('/search/?type=Award&limit=all', (resp)=>{
            this.setState({
                'externalTermMap' : _.object(_.map(resp['@graph'] || [], function(award){
                    return [ award.center_title, award.project !== '4DN' ];
                }))
            });
        });
    }

    render(){ return <StatsViewController {...this.props} {...this.state} />; }

}



class UsageChartsCountByDropdown extends React.PureComponent {

    constructor(props){
        super(props);
        this.handleSelection = this.handleSelection.bind(this);
    }

    handleSelection(evtKey, evt){
        const { changeCountByForChart, chartID } = this.props;
        changeCountByForChart(chartID, evtKey);
    }

    render(){
        const { countBy, chartID } = this.props;
        const currCountBy = countBy[chartID];

        const menuOptions = new Map();

        if (chartID === 'experiment_set_views' || chartID === 'file_views'){
            menuOptions.set('views',        <React.Fragment><i className="icon fas icon-fw icon-eye mr-1"/>Detail View</React.Fragment>);
            menuOptions.set('list_views',   <React.Fragment><i className="icon fas icon-fw icon-list mr-1"/>Appearance within first 25 Search Results</React.Fragment>);
            menuOptions.set('clicks',       <React.Fragment><i className="icon far icon-fw icon-hand-point-up mr-1"/>Search Result Click</React.Fragment>);
        } else if (chartID === 'file_downloads'){
            menuOptions.set('experiment_type', <React.Fragment><i className="icon far icon-fw icon-folder mr-1"/>Experiment Type</React.Fragment>);
            menuOptions.set('geo_country',     <React.Fragment><i className="icon fas icon-fw icon-globe mr-1"/>Country</React.Fragment>);
            menuOptions.set('filetype',     <React.Fragment><i className="icon far icon-fw icon-file-alt mr-1"/>File Type</React.Fragment>);
        } else {
            menuOptions.set('views',    <React.Fragment><i className="icon icon-fw fas icon-eye mr-1"/>View</React.Fragment>);
            menuOptions.set('sessions', <React.Fragment><i className="icon icon-fw fas icon-user mr-1"/>User Session</React.Fragment>);
        }

        const dropdownTitle = menuOptions.get(currCountBy);

        return (
            <div className="d-inline-block mr-05">
                <DropdownButton data-tip="Count By" size="sm" id={"select_count_for_" + chartID}
                    onSelect={this.handleSelection} title={dropdownTitle}>
                    {_.map([ ...menuOptions.entries() ], function([ k, title ]){
                        return <DropdownItem eventKey={k} key={k}>{ title }</DropdownItem>;
                    })}
                </DropdownButton>
            </div>
        );
    }
}


export function UsageStatsView(props){
    const {
        loadingStatus, mounted, session, groupByOptions, handleGroupByChange, currentGroupBy, windowWidth,
        changeCountByForChart, countBy,
        // Passed in from StatsChartViewAggregator:
        sessions_by_country, chartToggles, fields_faceted, /* fields_faceted_group_by, browse_search_queries, other_search_queries, */
        experiment_set_views, file_downloads, smoothEdges, onChartToggle, onSmoothEdgeToggle
    } = props;

    if (loadingStatus === 'failed'){
        return <div className="stats-charts-container" key="charts" id="usage"><ErrorIcon/></div>;
    }

    if (!mounted || (loadingStatus === 'loading' && (!file_downloads && !sessions_by_country))){
        return <div className="stats-charts-container" key="charts" id="usage"><LoadingIcon/></div>;
    }

    const { anyExpandedCharts, commonXDomain, dateRoundInterval } = useMemo(function(){
        const { fromDate, untilDate } = UsageStatsViewController.getSearchReqMomentsForTimePeriod(currentGroupBy);
        let dateRoundInterval;

        // We want all charts to share the same x axis. Here we round to date boundary.
        // Minor issue is that file downloads are stored in UTC/GMT while analytics are in EST timezone..
        // TODO improve on this somehow, maybe pass prop to FileDownload chart re: timezone parsing of some sort.
        if (currentGroupBy === 'daily'){
            fromDate.startOf('day').add(15, 'minute');
            untilDate.endOf('day').subtract(45, 'minute');
            dateRoundInterval = 'day';
        } else if (currentGroupBy === 'monthly') {
            fromDate.endOf('month'); // Not rly needed.
            untilDate.endOf('month').subtract(1, 'day');
            dateRoundInterval = 'month';
        } else if (currentGroupBy === 'yearly'){ // Not yet implemented
            dateRoundInterval = 'year';
        }

        return {
            anyExpandedCharts: _.any(_.values(chartToggles)),
            commonXDomain: [ fromDate.toDate(), untilDate.toDate() ],
            dateRoundInterval
        };
    }, [ currentGroupBy, anyExpandedCharts ]);

    const commonContainerProps = { 'onToggle' : onChartToggle, chartToggles, windowWidth, 'defaultColSize' : '12', 'defaultHeight' : anyExpandedCharts ? 200 : 250 };
    const commonChartProps = { dateRoundInterval, 'xDomain' : commonXDomain, 'curveFxn' : smoothEdges ? d3.curveMonotoneX : d3.curveStepAfter };
    const countByDropdownProps = { countBy, changeCountByForChart };

    return (
        <div className="stats-charts-container" key="charts" id="usage">

            <GroupByDropdown {...{ groupByOptions, loadingStatus, handleGroupByChange, currentGroupBy }}
                title="Show" outerClassName="dropdown-container mb-0">
                <div className="d-inline-block ml-15">
                    <Checkbox checked={smoothEdges} onChange={onSmoothEdgeToggle}>Smooth Edges</Checkbox>
                </div>
            </GroupByDropdown>

            { session && file_downloads ?

                <ColorScaleProvider resetScalesWhenChange={file_downloads}>

                    <hr/>

                    <AreaChartContainer {...commonContainerProps} id="file_downloads"
                        title={
                            <div>
                                <h4 className="text-500 mt-0 mb-0">File Downloads</h4>
                                <div className="mb-1">
                                    <small>
                                        <em>Download tracking started in August 2018 | Re-Implemented in Feb 2020</em>
                                    </small>
                                </div>
                            </div>
                        }
                        extraButtons={
                            <UsageChartsCountByDropdown {...countByDropdownProps} chartID="file_downloads" />
                        }>
                        <AreaChart {...commonChartProps} data={file_downloads} />
                    </AreaChartContainer>

                    <HorizontalD3ScaleLegend {...{ loadingStatus }} />

                </ColorScaleProvider>

                : null }

            { sessions_by_country ?

                <ColorScaleProvider resetScaleLegendWhenChange={sessions_by_country}>

                    <hr/>

                    <AreaChartContainer {...commonContainerProps} id="sessions_by_country"
                        title={
                            <h4 className="text-300 mt-0">
                                <span className="text-500">{ countBy.sessions_by_country === 'sessions' ? 'User Sessions' : 'Page Views' }</span> - by country
                            </h4>
                        }
                        extraButtons={<UsageChartsCountByDropdown {...countByDropdownProps} chartID="sessions_by_country" />}>
                        <AreaChart {...commonChartProps} data={sessions_by_country} />
                    </AreaChartContainer>

                    <HorizontalD3ScaleLegend {...{ loadingStatus }} />

                </ColorScaleProvider>

                : null }

            {/*
                Disabled for now until/if we want to bring this back:

                browse_search_queries || other_search_queries ?

                <ColorScaleProvider resetScalesWhenChange={browse_search_queries}>

                    <hr className="mt-3"/>

                    <HorizontalD3ScaleLegend {...{ loadingStatus }} />

                    { browse_search_queries ?
                        <AreaChartContainer {...commonContainerProps} id="browse_search_queries"
                            title={<span><span className="text-500">Experiment Set Search Queries</span> { currentGroupBy === 'sessions' ? '- Sessions' : '- Views' }</span>}>
                            <AreaChart data={browse_search_queries} xDomain={commonXDomain} />
                        </AreaChartContainer>
                    : null }

                    { other_search_queries ?
                        <AreaChartContainer {...commonContainerProps} id="other_search_queries"
                            title={<span><span className="text-500">Other Search Queries</span> { currentGroupBy === 'sessions' ? '- Sessions' : '- Views' }</span>}>
                            <AreaChart data={other_search_queries} xDomain={commonXDomain} />
                        </AreaChartContainer>
                    : null }

                </ColorScaleProvider>


            : null */}

            { session && experiment_set_views ?

                <ColorScaleProvider resetScaleLegendWhenChange={experiment_set_views}>

                    <hr className="mt-3"/>

                    <AreaChartContainer {...commonContainerProps} id="experiment_set_views"
                        title={
                            <h4 className="text-300 mt-0">
                                <span className="text-500">Experiment Set Detail Views</span>{' '}
                                { countBy.experiment_set_views === 'list_views' ? '- appearances within initial 25 browse results' :
                                    countBy.experiment_set_views === 'clicks' ? '- clicks from browse results' : '- page detail views' }
                                {' '}for top Items
                            </h4>
                        }
                        extraButtons={<UsageChartsCountByDropdown {...countByDropdownProps} chartID="experiment_set_views" />}>
                        <AreaChart {...commonChartProps} data={experiment_set_views} />
                    </AreaChartContainer>

                    <HorizontalD3ScaleLegend {...{ loadingStatus }} />

                </ColorScaleProvider>

                : null }

            { session && fields_faceted ?

                <ColorScaleProvider resetScaleLegendWhenChange={fields_faceted}>

                    <hr className="mt-3"/>

                    <AreaChartContainer {...commonContainerProps} id="fields_faceted"
                        title={
                            <h4 className="text-300 mt-0">
                                <span className="text-500">Top Fields Faceted</span> { countBy.fields_faceted === 'sessions' ? '- by user session' : '- by search result instance' }
                            </h4>
                        }
                        extraButtons={<UsageChartsCountByDropdown {...countByDropdownProps} chartID="fields_faceted" />}>
                        <AreaChart {...commonChartProps} data={fields_faceted} />
                    </AreaChartContainer>

                    <HorizontalD3ScaleLegend {...{ loadingStatus }} />

                </ColorScaleProvider>

                : null }

        </div>
    );
}

export function SubmissionsStatsView(props) {
    const {
        loadingStatus, mounted, session, currentGroupBy, groupByOptions, handleGroupByChange, windowWidth,
        // Passed in from StatsChartViewAggregator:
        expsets_released, expsets_released_internal, files_released, file_volume_released,
        expsets_released_vs_internal, chartToggles, smoothEdges, width, onChartToggle, onSmoothEdgeToggle
    } = props;

    if (!mounted || (!expsets_released)){
        return <div className="stats-charts-container" key="charts" id="submissions"><LoadingIcon/></div>;
    }

    if (loadingStatus === 'failed'){
        return <div className="stats-charts-container" key="charts" id="submissions"><ErrorIcon/></div>;
    }

    const anyExpandedCharts = _.any(_.values(chartToggles));
    const commonContainerProps = {
        'onToggle' : onChartToggle, chartToggles, windowWidth,
        'defaultColSize' : '12', 'defaultHeight' : anyExpandedCharts ? 200 : 250
    };
    const showInternalReleaseCharts = session && expsets_released_internal && expsets_released_vs_internal;
    const commonChartProps = { 'curveFxn' : smoothEdges ? d3.curveMonotoneX : d3.curveStepAfter };

    return (
        <div className="stats-charts-container" key="charts" id="submissions">

            { showInternalReleaseCharts ?

                <ColorScaleProvider width={width} colorScale={SubmissionsStatsView.colorScaleForPublicVsInternal}>

                    <AreaChartContainer {...commonContainerProps} id="expsets_released_vs_internal"
                        title={<h4 className="text-300 mt-0"><span className="text-500">Experiment Sets</span> - internal vs public release</h4>}>
                        <AreaChart {...commonChartProps} data={expsets_released_vs_internal} />
                    </AreaChartContainer>

                    <hr/>

                </ColorScaleProvider>

                : null }

            <ColorScaleProvider width={width} resetScalesWhenChange={expsets_released}>

                <GroupByDropdown {...{ currentGroupBy, groupByOptions, handleGroupByChange, loadingStatus }} title="Group Charts Below By">
                    <div className="d-inline-block ml-15">
                        <Checkbox checked={smoothEdges} onChange={onSmoothEdgeToggle}>Smooth Edges</Checkbox>
                    </div>
                </GroupByDropdown>

                <hr/>

                <HorizontalD3ScaleLegend {...{ loadingStatus }} />

                <AreaChartContainer {...commonContainerProps} id="expsets_released" title={
                    <h4 className="text-300 mt-0">
                        <span className="text-500">Experiment Sets</span> - { session ? 'publicly released' : 'released' }
                    </h4>
                }>
                    <AreaChart {...commonChartProps} data={expsets_released} />
                </AreaChartContainer>

                { showInternalReleaseCharts ?
                    <AreaChartContainer {...commonContainerProps} id="expsets_released_internal" title={
                        <h4 className="text-300 mt-0">
                            <span className="text-500">Experiment Sets</span> - released (public or within 4DN)
                        </h4>
                    }>
                        <AreaChart {...commonChartProps} data={expsets_released_internal} />
                    </AreaChartContainer>
                    : null }

                <AreaChartContainer {...commonContainerProps} id="files_released" title={
                    <h4 className="text-300 mt-0">
                        <span className="text-500">Files</span> - { session ? 'publicly released' : 'released' }
                    </h4>
                }>
                    <AreaChart {...commonChartProps} data={files_released} />
                </AreaChartContainer>

                <AreaChartContainer {...commonContainerProps} id="file_volume_released" title={
                    <h4 className="text-300 mt-0">
                        <span className="text-500">Total File Size</span> - { session ? 'publicly released' : 'released' }
                    </h4>
                }>
                    <AreaChart {...commonChartProps} data={file_volume_released} yAxisLabel="GB" />
                </AreaChartContainer>

            </ColorScaleProvider>

        </div>
    );
}

/**
 * Use this only for charts with child terms 'Internal Release' and 'Public Release', which are
 * meant to have a separate color scale and child terms from other charts.
 *
 * @param {string} term - One of 'Internal Release' or 'Public Release'.
 * @returns {string} A CSS-valid color string.
 */
SubmissionsStatsView.colorScaleForPublicVsInternal = function(term){
    if (term === 'Internal Release' || term === 'Internally Released'){
        return '#ff7f0e'; // Orange
    } else if (term === 'Public Release' || term === 'Publicly Released'){
        return '#1f77b4'; // Blue
    } else {
        logger.error("Term supplied is not one of 'Internal Release' or 'Public Release': '" + term + "'.");
        throw new Error("Term supplied is not one of 'Internal Release' or 'Public Release': '" + term + "'.");
    }
};









function groupExternalChildren(children, externalTermMap){

    if (!externalTermMap){
        return children;
    }

    const filteredOut = [];
    const newChildren = children.filter(function(c){
        if (externalTermMap[c.term]) {
            filteredOut.push(c);
            return false;
        }
        return true;
    });
    if (filteredOut.length > 0){
        const externalChild = {
            'term' : 'External',
            'count': 0,
            'total': 0
        };
        filteredOut.forEach(function(c){
            externalChild.total += c.total;
            externalChild.count += c.count;
        });
        newChildren.push(externalChild);
    }
    return newChildren;
}