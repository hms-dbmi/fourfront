import _ from 'underscore';
import { console, isServerSide, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

export class ColorCycler {

    static defaultProps = {
        'colorPalette' : [
            '#5da5da',  // blue
            '#faa43a',  // orange
            '#60bd68',  // green
            '#f17cb0',  // pink
            '#b2912f',  // brown
            '#b276b2',  // purple
            '#decf3f',  // yellow
            '#f15854',  // red
            '#4d4d4d'   // gray
        ]
    }

    constructor(props){
        this.props = _.extend({}, ColorCycler.defaultProps, (props || {}));
        this.colorCacheByField = {};
        this._addToColorCacheByField = this._addToColorCacheByField.bind(this);
        this._getFromColorCacheByField = this._getFromColorCacheByField.bind(this);
        this.resetCache = this.resetCache.bind(this);
        this.colorForNode = this.colorForNode.bind(this);
    }

    resetCache(){
        this.colorCacheByField = {};
    }

    _getFromColorCacheByField(field, term){
        if (typeof this.colorCacheByField[field] === 'undefined'){
            return null;
        }
        return (this.colorCacheByField[field][term] && this.colorCacheByField[field][term].color) || null;
    }

    _addToColorCacheByField(field, term, color = null){
        if (typeof this.colorCacheByField[field] === 'undefined'){
            this.colorCacheByField[field] = {};
        }
        var index = _.keys(this.colorCacheByField[field]).length || 0;
        if (!color){
            // Select one.
            color = this.props.colorPalette[index % this.props.colorPalette.length];
        }
        this.colorCacheByField[field][term] = {
            'index' : index,
            'color' : color
        };

        return color;
    }

    sortObjectsByColorPalette(objects, colorProperty = 'color'){

        var orderedColorList = this.props.colorPalette;

        if (!orderedColorList) {
            logger.error("No palette found on ColorCycler instance.");
            return objects;
        }

        if (objects && objects[0] && !objects[0].color){
            console.warn("No colors assigned to objects.");
            return objects;
        }

        var groups = _.groupBy(objects, colorProperty);
        var runs = 0;

        function getSortedSection(){
            return _.map(orderedColorList, function(color){
                var o = groups[color] && groups[color].pop();
                if (groups[color] && groups[color].length === 0) delete groups[color];
                return o;
            }).filter(function(o){
                if (!o) return false;
                return true;
            });
        }

        var result = [];
        while (_.keys(groups).length > 0 && runs < 20){
            result = result.concat(getSortedSection());
            runs++;
        }

        if (runs > 1){
            console.warn("sortObjectsByColorPalette took longer than 1 run: " + runs, groups);
        }

        return result;
    }

    colorForNode(node, cachedOnly = true, nullInsteadOfDefaultColor = false){

        var defaultColor = nullInsteadOfDefaultColor ? null : '#aaaaaa';

        var nodeDatum = node.data || node, // Handle both pre-D3-ified and post-D3-ified nodes.
            field = nodeDatum.field || null,
            term = (nodeDatum.term && nodeDatum.term.toLowerCase()) || null;


        // Handle exceptions first
        if (nodeDatum.color){
            return nodeDatum.color;
        } else if (field === 'accession'){ // This is an experiment_set node. We give it a unique color.
            return defaultColor;
        }

        // Grab from existing cache, if set.
        var existingColor = this._getFromColorCacheByField(field,term);
        if (existingColor !== null || cachedOnly) return existingColor;

        // Set a cycled palette color
        return this._addToColorCacheByField(field, term, null);
    }

}

// Used for BarPlotChart.
// TODO eventually: move this instantiation into a top-level component of Chart (probably UIControlsWrapper) and pass it down as a prop.
// Or keep it here, and define other ones alongside it if needed, idk.
export const barplot_color_cycler = new ColorCycler();
