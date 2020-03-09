"""Abstract collection for experiment and integration of all experiment types."""

from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema
)
from snovault.validators import (
    validate_item_content_post,
    validate_item_content_put,
    validate_item_content_patch,
    validate_item_content_in_place,
    no_validate_item_content_post,
    no_validate_item_content_put,
    no_validate_item_content_patch
)
from snovault.crud_views import (
    collection_add,
    item_edit,
)
from pyramid.view import view_config
from snovault.attachment import ItemWithAttachment
from snovault.util import debug_log
from .base import (
    Item,
    ALLOW_SUBMITTER_ADD,
    get_item_if_you_can,
    lab_award_attribution_embed_list
)

EXP_CATEGORIZER_SCHEMA = {
    "title": "Categorizer",
    "description": "Fields used as an additional level of categorization for an experiment",
    "type": "object",
    "properties": {
        "field": {
            "type": "string",
            "description": "The name of the field as to be displayed in tables."
        },
        "value": {
            "type": "string",
            "description": "The value displayed for the field"
        },
        "combined": {
            "type": "string",
            "description": "Combined field:value string used for categorization of this experiment."
        }
    }
}


@abstract_collection(
    name='experiments',
    unique_key='accession',
    acl=ALLOW_SUBMITTER_ADD,
    properties={
        'title': "Experiments",
        'description': 'Listing of all types of experiments.',
    })
class Experiment(Item):
    """The main experiment class."""
    item_type = 'experiment'
    base_types = ['Experiment'] + Item.base_types
    schema = load_schema('encoded:schemas/experiment.json')
    name_key = 'accession'
    rev = {
        'experiment_sets': ('ExperimentSet', 'experiments_in_set')
    }
    aggregated_items = {
        "badges": [
            "messages",
            "badge.commendation",
            "badge.warning",
            "badge.uuid",
            "badge.@id",
            "badge.badge_icon",
            "badge.description"
        ]
    }
    embedded_list = Item.embedded_list + lab_award_attribution_embed_list + [
        "badges.badge.title",
        "badges.badge.commendation",
        "badges.badge.warning",
        "badges.badge.badge_classification",
        "badges.badge.description",
        "badges.badge.badge_icon",
        "badges.messages",
        "experiment_sets.experimentset_type",
        "experiment_sets.@type",
        "experiment_sets.accession",
        # "experiment_type.display_title",
        "produced_in_pub.title",
        "produced_in_pub.abstract",
        "produced_in_pub.journal",
        "produced_in_pub.authors",
        "produced_in_pub.short_attribution",
        "produced_in_pub.date_published",
        "publications_of_exp.title",
        "publications_of_exp.abstract",
        "publications_of_exp.journal",
        "publications_of_exp.authors",
        "publications_of_exp.short_attribution",
        "publications_of_exp.date_published",
        "biosample.accession",
        "biosample.modifications_summary",
        "biosample.treatments_summary",
        "biosample.biosource_summary",
        "biosample.biosample_type",
        "biosample.biosource.biosource_type",
        "biosample.biosource.cell_line.slim_terms",
        "biosample.biosource.cell_line.synonyms",
        "biosample.biosource.tissue.slim_terms",
        "biosample.biosource.tissue.synonyms",
        "biosample.biosource.individual.organism.name",
        "biosample.modifications.modification_type",
        "biosample.modifications.display_title",
        "biosample.treatments.treatment_type",
        "biosample.treatments.display_title",
        "biosample.badges.badge.title",
        "biosample.badges.badge.commendation",
        "biosample.badges.badge.warning",
        "biosample.badges.badge.badge_classification",
        "biosample.badges.badge.description",
        "biosample.badges.badge.badge_icon",
        "biosample.badges.messages",

        "experiment_type.experiment_category",
        "experiment_type.assay_subclass_short",

        "files.href",
        "files.accession",
        "files.uuid",
        "files.file_size",
        "files.upload_key",
        "files.file_format",
        "files.file_classification",
        "files.file_type_detailed",
        "files.paired_end",
        # "files.badges.badge.title",
        # "files.badges.badge.commendation",
        # "files.badges.badge.warning",
        # "files.badges.badge.badge_classification",
        # "files.badges.badge.description",
        # "files.badges.badge.badge_icon",
        # "files.badges.messages",
        "files.quality_metric.Total Sequences",
        "files.quality_metric.Sequence length",
        "files.quality_metric.url",
        "files.quality_metric.overall_quality_status",
        "files.quality_metric_summary.*",

        "processed_files.href",
        "processed_files.accession",
        "processed_files.uuid",
        "processed_files.file_size",
        "processed_files.upload_key",
        "processed_files.file_format",
        "processed_files.file_classification",
        "processed_files.file_type_detailed",
        "processed_files.quality_metric.url",
        "processed_files.quality_metric.overall_quality_status",
        "processed_files.quality_metric_summary.*",

        "other_processed_files.files.href",
        "other_processed_files.title",
        "other_processed_files.description",
        "other_processed_files.type",
        "other_processed_files.files.file_type_detailed",
        "other_processed_files.files.file_format",
        "other_processed_files.files.file_size",
        "other_processed_files.files.higlass_uid",
        "other_processed_files.files.genome_assembly",
        "other_processed_files.files.status",
        "other_processed_files.files.last_modified.date_modified",
        "other_processed_files.files.quality_metric.url",
        "other_processed_files.files.quality_metric.overall_quality_status",
        "other_processed_files.files.quality_metric_summary.*",
        "other_processed_files.files.notes_to_tsv",

        "reference_files.accession",
        "reference_files.file_type_detailed",
        "reference_files.file_size",
        "reference_files.file_classification",
        "reference_files.status"
    ]

    def generate_mapid(self, experiment_type, num):
        delim = '_'
        mapid = str(type(self).__name__)
        mapid = mapid + delim + ''.join(experiment_type.split())
        return mapid + delim + str(num)

    def has_bad_status(self, status):
        bad_statuses = ["revoked", "deleted", "obsolete", "replaced"]
        return status in bad_statuses

    def find_current_sop_map(self, experiment_type, sop_coll=None):
        maps = []
        suffnum = 1
        mapid = self.generate_mapid(experiment_type, suffnum)
        if sop_coll is not None:
            while(True):
                m = sop_coll.get(mapid)
                if not m:
                    break
                if not self.has_bad_status(m.properties.get('status')):
                    maps.append(m)
                suffnum += 1
                mapid = self.generate_mapid(experiment_type, suffnum)

        if len(maps) > 0:
            sopmap = maps[-1]
            try:
                status = sopmap.properties.get('status')
                if not self.has_bad_status(status):
                    return sopmap
            except AttributeError:  # pragma: no cover
                pass
        return None

    def _update(self, properties, sheets=None):
        sop_coll = None
        exp_type = self.registry['collections']['ExperimentType']
        exp_type_title = exp_type.get(properties['experiment_type']).properties['title']
        if 'sop_mapping' in properties.keys():
            # check if the SopMap has bad Status
            sop_coll = self.registry['collections']['SopMap']
            currmap = properties['sop_mapping'].get('sopmap')
            if currmap:
                try:
                    if self.has_bad_status(sop_coll.get(currmap)['status']):
                        # delete mapping from properties
                        del properties['sop_mapping']
                except AttributeError:
                    # want to do some logging
                    print("CHECK STATUS OF SOP MAP")

        if 'sop_mapping' not in properties.keys():
            if sop_coll is None:
                sop_coll = self.registry['collections']['SopMap']
            # if sop_mapping field not present see if it should be
            sopmap = self.find_current_sop_map(exp_type_title, sop_coll)
            properties['sop_mapping'] = {}
            if sopmap is not None:
                sop_mapping = str(sopmap.uuid)
                properties['sop_mapping']['sop_map'] = sop_mapping
                properties['sop_mapping']['has_sop'] = "Yes"
            else:
                properties['sop_mapping']['has_sop'] = "No"

        # update self first to ensure 'experiment_relation' are stored in self.properties
        super(Experiment, self)._update(properties, sheets)

        DicRefRelation = {
            "controlled by": "control for",
            "derived from": "source for",
            "control for": "controlled by",
            "source for": "derived from",
            "input of": "has input",
            "has input": "input of"
        }
        acc = str(self.uuid)
        if 'experiment_relation' in properties.keys():
            for relation in properties["experiment_relation"]:
                switch = relation["relationship_type"]
                rev_switch = DicRefRelation[switch]
                related_exp = relation["experiment"]
                relationship_entry = {"relationship_type": rev_switch, "experiment": acc}
                rel_dic = {'experiment_relation': [relationship_entry, ]}

                target_exp = self.collection.get(related_exp)
                # case one we don't have relations
                if 'experiment_relation' not in target_exp.properties.keys():
                    target_exp.properties.update(rel_dic)
                    target_exp.update(target_exp.properties)
                else:
                    # case two we have relations but not the one we need
                    for target_relation in target_exp.properties['experiment_relation']:
                        if target_relation['experiment'] == acc:
                            break
                    else:
                        # make data for new experiemnt_relation
                        target_exp.properties['experiment_relation'].append(relationship_entry)
                        target_exp.update(target_exp.properties)

    @calculated_property(schema={
        "title": "Experiment Sets",
        "description": "Experiment Sets to which this experiment belongs.",
        "type": "array",
        "exclude_from": ["submit4dn", "FFedit-create"],
        "items": {
            "title": "Experiment Set",
            "type": ["string", "object"],
            "linkTo": "ExperimentSet"
        }
    })
    def experiment_sets(self, request):
        return self.rev_link_atids(request, "experiment_sets")

    @calculated_property(schema={
        "title": "Produced in Publication",
        "description": "The Publication in which this Experiment was produced.",
        "type": "string",
        "linkTo": "Publication"
    })
    def produced_in_pub(self, request, references=None):
        # references field is the boss if it exists
        # in each case selecting the first member if multiple
        if references:
            return references[0]

        esets = [request.embed('/', str(uuid), '@@object') for uuid in
                 self.experiment_sets(request)]
        # replicate experiment set is the boss
        reps = [eset for eset in esets if 'ExperimentSetReplicate' in eset['@type']]
        if reps:
            return reps[0].get('produced_in_pub')

    @calculated_property(schema={
        "title": "Publications",
        "description": "Publications associated with this Experiment.",
        "type": "array",
        "items": {
            "title": "Publication",
            "type": "string",
            "linkTo": "Publication"
        }
    })
    def publications_of_exp(self, request):
        esets = [request.embed('/', str(uuid), '@@object') for uuid in
                 self.experiment_sets(request)]
        import itertools
        pubs = list(set(itertools.chain.from_iterable([eset.get('publications_of_set', [])
                                                      for eset in esets])))
        return pubs

    @calculated_property(schema=EXP_CATEGORIZER_SCHEMA)
    def experiment_categorizer(self, request, experiment_type, digestion_enzyme=None, targeted_factor=None):
        ''' The generalish case for if there is a targeted_factor use that
            and if not use enzyme - more specific cases in specific schemas
        '''
        out_dict = {
            "field": "Default",
            "value": None
        }
        types4control = [
            '/experiment-types/damid-seq/', '/experiment-types/chip-seq/',
            '/experiment-types/nad-seq/', '/experiment-types/cut-n-run/'
        ]
        if experiment_type in types4control and not targeted_factor:
            out_dict['field'] = 'Target'
            out_dict['value'] = 'None (Control)'
        elif targeted_factor:
            tstring = ''
            for tf in targeted_factor:
                target_props = request.embed(tf, '@@object')
                tstring += ', {}'.format(target_props['display_title'])
            out_dict['field'] = 'Target'
            out_dict['value'] = tstring[2:]
        elif digestion_enzyme:
            obj = request.embed('/', digestion_enzyme, '@@object')
            out_dict['field'] = 'Enzyme'
            out_dict['value'] = obj['display_title']
        if out_dict['value'] is not None:
            out_dict['combined'] = out_dict['field'] + ': ' + out_dict['value']
        return out_dict

    class Collection(Item.Collection):
        pass


@collection(
    name='experiments-hi-c',
    unique_key='accession',
    properties={
        'title': 'Experiments Hi-C',
        'description': 'Listing Hi-C Experiments',
    })
class ExperimentHiC(Experiment):
    """The experiment class for Hi-C experiments."""

    item_type = 'experiment_hi_c'
    schema = load_schema('encoded:schemas/experiment_hi_c.json')
    embedded_list = Experiment.embedded_list + ["digestion_enzyme.name"]
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type, enzyme and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, digestion_enzyme=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']
        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        if digestion_enzyme:
            de_props = request.embed(digestion_enzyme, '@@object')
            de_name = de_props['name']
            sum_str += (' with ' + de_name)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, digestion_enzyme=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, digestion_enzyme))


@collection(
    name='experiments-capture-c',
    unique_key='accession',
    properties={
        'title': 'Experiments Capture Hi-C',
        'description': 'Listing Capture Hi-C Experiments',
    })
class ExperimentCaptureC(Experiment):
    """The experiment class for Capture Hi-C experiments."""
    item_type = 'experiment_capture_c'
    schema = load_schema('encoded:schemas/experiment_capture_c.json')
    embedded_list = Experiment.embedded_list + ["digestion_enzyme.name",
                                                "targeted_regions.target.display_title",
                                                "targeted_regions.oligo_file.href"]
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type, enzyme and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, digestion_enzyme=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']

        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']

        sum_str += (' on ' + biosource)
        if digestion_enzyme:
            de_props = request.embed(digestion_enzyme, '@@object')
            de_name = de_props['name']
            sum_str += (' with ' + de_name)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, digestion_enzyme=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, digestion_enzyme))

    @calculated_property(schema=EXP_CATEGORIZER_SCHEMA)
    def experiment_categorizer(self, request, experiment_type, biosample, targeted_regions=None, digestion_enzyme=None):
        ''' Use targeted_regions information for capture-c'''
        if targeted_regions:
            regions = []
            for tregion in targeted_regions:
                targetfeats = tregion.get('target', [])
                for feat in targetfeats:
                    region = request.embed(feat, '@@object')['display_title']
                    regions.append(region)
            if regions:
                value = ', '.join(sorted(regions))
                return {
                    'field': 'Target',
                    'value': value,
                    'combined': 'Target: ' + value
                }

        return super(ExperimentCaptureC, self).experiment_categorizer(request, experiment_type, digestion_enzyme)


@collection(
    name='experiments-repliseq',
    unique_key='accession',
    properties={
        'title': 'Experiments Repli-seq',
        'description': 'Listing of Repli-seq Experiments',
    })
class ExperimentRepliseq(Experiment):
    """The experiment class for Repli-seq experiments."""
    item_type = 'experiment_repliseq'
    schema = load_schema('encoded:schemas/experiment_repliseq.json')
    embedded_list = Experiment.embedded_list
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type, enzyme and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, cell_cycle_phase=None, stage_fraction=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']
        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        if cell_cycle_phase:
            sum_str += (' ' + cell_cycle_phase + '-phase')
        if stage_fraction:
            sum_str += (' ' + stage_fraction)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, cell_cycle_phase=None, stage_fraction=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, cell_cycle_phase, stage_fraction))

    @calculated_property(schema=EXP_CATEGORIZER_SCHEMA)
    def experiment_categorizer(self, request, experiment_type, biosample, stage_fraction=None, total_fractions_in_exp=None):
        ''' Use combination of fraction and total number of fractions'''
        if stage_fraction:
            value = stage_fraction + ' of '
            if not total_fractions_in_exp:
                fraction = 'an unspecified number of fractions'
            else:
                fraction = str(total_fractions_in_exp) + ' fractions'
            value = value + fraction
            return {
                'field': 'Fraction',
                'value': value,
                'combined': 'Fraction: ' + value
            }
        else:
            return super(ExperimentRepliseq, self).experiment_categorizer(request, experiment_type)


@collection(
    name='experiments-atacseq',
    unique_key='accession',
    properties={
        'title': 'Experiments ATAC-seq',
        'description': 'Listing ATAC-seq Experiments',
    })
class ExperimentAtacseq(Experiment):
    """The experiment class for ATAC-seq experiments."""

    item_type = 'experiment_atacseq'
    schema = load_schema('encoded:schemas/experiment_atacseq.json')
    embedded_list = Experiment.embedded_list
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample):
        sum_str = request.embed(experiment_type, '@@object')['display_title']
        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample))


@collection(
    name='experiments-chiapet',
    unique_key='accession',
    properties={
        'title': 'Experiments CHIA-pet',
        'description': 'Listing CHIA-pet and PLAC-seq Experiments',
    })
class ExperimentChiapet(Experiment):
    """The experiment class for CHIA-pet and PLAC-seq experiments."""

    item_type = 'experiment_chiapet'
    schema = load_schema('encoded:schemas/experiment_chiapet.json')
    embedded_list = Experiment.embedded_list
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, targeted_factor=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']

        if targeted_factor:
            tstring = ''
            for tf in targeted_factor:
                target_props = request.embed(tf, '@@object')
                tstring += ', {}'.format(target_props['display_title'])
            sum_str += (' against ' + tstring[2:])

        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, targeted_factor=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, targeted_factor))


@collection(
    name='experiments-damid',
    unique_key='accession',
    properties={
        'title': 'Experiments DAM-ID',
        'description': 'Listing DAM-ID Experiments',
    })
class ExperimentDamid(Experiment):
    """The experiment class for DAM-ID experiments."""

    item_type = 'experiment_damid'
    schema = load_schema('encoded:schemas/experiment_damid.json')
    embedded_list = Experiment.embedded_list
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, targeted_factor=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']

        if targeted_factor:
            if len(targeted_factor) == 1:
                tname = request.embed(targeted_factor[0], '@@object')['display_title']
                fusion = tname.split(' ')[0]
                sum_str += (' with DAM-' + fusion)
            else:
                sum_str += (' with mulitiple DAM fusions')

        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, targeted_factor=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, targeted_factor))


@collection(
    name='experiments-seq',
    unique_key='accession',
    properties={
        'title': 'Experiments CHIPseq, RNAseq ...',
        'description': 'Listing of ChIP and RNA seq type experiments',
    })
class ExperimentSeq(ItemWithAttachment, Experiment):
    """The experiment class for ChIPseq and RNAseq and potentially other types."""

    item_type = 'experiment_seq'
    schema = load_schema('encoded:schemas/experiment_seq.json')
    embedded_list = Experiment.embedded_list
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, targeted_factor=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']

        if targeted_factor:
            tstring = ''
            for tf in targeted_factor:
                target_props = request.embed(tf, '@@object')
                tstring += ', {}'.format(target_props['display_title'])
            sum_str += (' against ' + tstring[2:])

        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, targeted_factor=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, targeted_factor))


@collection(
    name='experiments-tsaseq',
    unique_key='accession',
    properties={
        'title': 'Experiments TSA-Seq',
        'description': 'Listing of TSA-seq type experiments',
    })
class ExperimentTsaseq(ItemWithAttachment, Experiment):
    """The experiment class for TSA-seq."""

    item_type = 'experiment_tsaseq'
    schema = load_schema('encoded:schemas/experiment_tsaseq.json')
    embedded_list = Experiment.embedded_list
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample, targeted_factor=None):
        sum_str = request.embed(experiment_type, '@@object')['display_title']

        if targeted_factor:
            tstring = ''
            for tf in targeted_factor:
                target_props = request.embed(tf, '@@object')
                tstring += ', {}'.format(target_props['display_title'])
            sum_str += (' against ' + tstring[2:])

        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample, targeted_factor=None):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample, targeted_factor))


@collection(
    name='experiments-mic',
    unique_key='accession',
    properties={
        'title': 'Microscopy Experiments',
        'description': 'Listing of Microscopy Experiments',
    })
class ExperimentMic(Experiment):
    """The experiment class for Microscopy experiments."""
    item_type = 'experiment_mic'
    schema = load_schema('encoded:schemas/experiment_mic.json')
    embedded_list = Experiment.embedded_list + [
        "files.microscope_settings.ch00_light_source_center_wl",
        "files.microscope_settings.ch01_light_source_center_wl",
        "files.microscope_settings.ch02_light_source_center_wl",
        "files.microscope_settings.ch03_light_source_center_wl",
        "files.microscope_settings.ch00_lasers_diodes",
        "files.microscope_settings.ch01_lasers_diodes",
        "files.microscope_settings.ch02_lasers_diodes",
        "files.microscope_settings.ch03_lasers_diodes",

        'sample_image.caption',
        'sample_image.microscopy_file.accession',
        'sample_image.microscopy_file.omerolink',
        'sample_image.attachment.href',
        'sample_image.attachment.type',
        'sample_image.attachment.md5sum',
        'sample_image.attachment.download',
        'sample_image.attachment.width',
        'sample_image.attachment.height'
    ]
    name_key = 'accession'

    @calculated_property(schema={
        "title": "Experiment summary",
        "description": "Summary of the experiment, including type, enzyme and biosource.",
        "type": "string",
    })
    def experiment_summary(self, request, experiment_type, biosample):
        sum_str = request.embed(experiment_type, '@@object')['display_title']
        biosamp_props = request.embed(biosample, '@@object')
        biosource = biosamp_props['biosource_summary']
        sum_str += (' on ' + biosource)
        return sum_str

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, experiment_type, biosample):
        return self.add_accession_to_title(self.experiment_summary(request, experiment_type, biosample))

    @calculated_property(schema=EXP_CATEGORIZER_SCHEMA)
    def experiment_categorizer(self, request, experiment_type, biosample, imaging_paths=None):
        ''' Use the target(s) in the imaging path'''
        if imaging_paths:
            path_targets = []
            for pathobj in imaging_paths:
                path = request.embed('/', pathobj['path'], '@@object')
                for target in path.get('target', []):
                    summ = request.embed('/', target, '@@object')['display_title']
                    path_targets.append(summ)
            if path_targets:
                value = ', '.join(list(set(path_targets)))
                return {
                    'field': 'Target',
                    'value': value,
                    'combined': 'Target: ' + value
                }
        return super(ExperimentMic, self).experiment_categorizer(request, experiment_type)


@calculated_property(context=Experiment, category='action')
def clone(context, request):
    """If the user submits for any lab, allow them to clone
    This is like creating, but keeps previous fields"""
    if request.has_permission('create'):
        return {
            'name': 'clone',
            'title': 'Clone',
            'profile': '/profiles/{ti.name}.json'.format(ti=context.type_info),
            'href': '{item_uri}#!clone'.format(item_uri=request.resource_path(context)),
        }


def validate_exp_type_validity_for_experiment(context, request):
    """Check if the specified experiment type (e.g. in situ Hi-C) is allowed
    for the experiment schema (e.g. ExperimentHiC).
    """
    data = request.json
    if 'experiment_type' in data:
        exp_type_item = get_item_if_you_can(request, data['experiment_type'], 'experiment-types')
        if not exp_type_item:  # pragma: no cover
            # item level validation will take care of generating the error
            return
        exp_type_name = exp_type_item['title']
        allowed_types = exp_type_item.get('valid_item_types', [])
        exp = context.type_info.name
        if exp not in allowed_types:
            msg = 'Experiment Type {} is not allowed for {}'.format(exp_type_name, exp)
            request.errors.add('body', 'Experiment: invalid experiment type', msg)
        else:
            request.validated.update({})


@view_config(context=Experiment.Collection, permission='add', request_method='POST',
             validators=[validate_item_content_post, validate_exp_type_validity_for_experiment])
@view_config(context=Experiment.Collection, permission='add_unvalidated', request_method='POST',
             validators=[no_validate_item_content_post],
             request_param=['validate=false'])
@debug_log
def experiment_add(context, request, render=None):
    return collection_add(context, request, render)


@view_config(context=Experiment, permission='edit', request_method='PUT',
             validators=[validate_item_content_put, validate_exp_type_validity_for_experiment])
@view_config(context=Experiment, permission='edit', request_method='PATCH',
             validators=[validate_item_content_patch, validate_exp_type_validity_for_experiment])
@view_config(context=Experiment, permission='edit_unvalidated', request_method='PUT',
             validators=[no_validate_item_content_put],
             request_param=['validate=false'])
@view_config(context=Experiment, permission='edit_unvalidated', request_method='PATCH',
             validators=[no_validate_item_content_patch],
             request_param=['validate=false'])
@view_config(context=Experiment, permission='index', request_method='GET',
             validators=[validate_item_content_in_place, validate_exp_type_validity_for_experiment],
             request_param=['check_only=true'])
@debug_log
def experiment_edit(context, request, render=None):
    return item_edit(context, request, render)
