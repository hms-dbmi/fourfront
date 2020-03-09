"""Collection for ExperimentSet and ExperimentSetReplicate."""

from pyramid.threadlocal import get_current_request
from pyramid.view import view_config
from snovault import (
    calculated_property,
    collection,
    load_schema,
    AfterModified,
    BeforeModified
)
from snovault.calculated import calculate_properties
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
from snovault.util import debug_log
from .base import (
    Item,
    lab_award_attribution_embed_list,
    get_item_if_you_can
)
import datetime


@collection(
    name='experiment-sets',
    unique_key='accession',
    properties={
        'title': 'Experiment Sets',
        'description': 'Listing Experiment Sets',
    })
class ExperimentSet(Item):
    """The experiment set class."""

    item_type = 'experiment_set'
    schema = load_schema('encoded:schemas/experiment_set.json')
    name_key = "accession"
    rev = {
        'publications_using': ('Publication', 'exp_sets_used_in_pub'),
        'publications_produced': ('Publication', 'exp_sets_prod_in_pub'),
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
        ],
        "tissue": ["preferred_name"],
        "SOP_cell_line": ["display_title"]
    }
    embedded_list = Item.embedded_list + lab_award_attribution_embed_list + [
        "badges.badge.title",
        "badges.badge.commendation",
        "badges.badge.warning",
        "badges.badge.badge_classification",
        "badges.badge.description",
        "badges.badge.badge_icon",
        "badges.messages",

        "produced_in_pub.title",
        "produced_in_pub.abstract",
        "produced_in_pub.journal",
        "produced_in_pub.authors",
        "produced_in_pub.short_attribution",
        "produced_in_pub.date_published",
        "publications_of_set.title",
        "publications_of_set.abstract",
        "publications_of_set.journal",
        "publications_of_set.authors",
        "publications_of_set.date_published",

        "experiments_in_set.@type",
        "experiments_in_set.experiment_type.display_title",
        "experiments_in_set.experiment_type.assay_classification",
        "experiments_in_set.experiment_type.assay_subclassification",
        "experiments_in_set.experiment_type.assay_subclass_short",
        "experiments_in_set.experiment_type.experiment_category",
        "experiments_in_set.experiment_type.other_tags",
        "experiments_in_set.accession",
        "experiments_in_set.status",
        "experiments_in_set.experiment_categorizer.field",
        "experiments_in_set.experiment_categorizer.value",
        "experiments_in_set.experiment_categorizer.combined",

        "experiments_in_set.badges.badge.title",
        "experiments_in_set.badges.badge.commendation",
        "experiments_in_set.badges.badge.warning",
        "experiments_in_set.badges.badge.badge_classification",
        "experiments_in_set.badges.badge.badge_icon",
        "experiments_in_set.badges.badge.description",
        "experiments_in_set.badges.messages",

        "experiments_in_set.biosample.accession",
        "experiments_in_set.biosample.modifications_summary",
        "experiments_in_set.biosample.biosource_summary",
        "experiments_in_set.biosample.biosample_type",
        "experiments_in_set.biosample.biosample_category",
        "experiments_in_set.biosample.biosource.biosource_type",
        "experiments_in_set.biosample.biosource.SOP_cell_line",
        "experiments_in_set.biosample.biosource.cell_line.preferred_name",
        "experiments_in_set.biosample.biosource.cell_line.slim_terms",
        "experiments_in_set.biosample.biosource.cell_line.synonyms",
        "experiments_in_set.biosample.biosource.tissue.preferred_name",
        "experiments_in_set.biosample.biosource.tissue.slim_terms",
        "experiments_in_set.biosample.biosource.tissue.synonyms",
        "experiments_in_set.biosample.biosource.cell_line_tier",
        "experiments_in_set.biosample.biosource.individual.organism.name",
        "experiments_in_set.biosample.cell_culture_details.SOP_cell_line",
        "experiments_in_set.biosample.cell_culture_details.tissue.preferred_name",
        "experiments_in_set.biosample.modifications.modification_type",
        "experiments_in_set.biosample.modifications.display_title",
        "experiments_in_set.biosample.treatments.treatment_type",
        "experiments_in_set.biosample.treatments.display_title",
        "experiments_in_set.biosample.treatments_summary",
        "experiments_in_set.biosample.badges.badge.title",
        "experiments_in_set.biosample.badges.badge.commendation",
        "experiments_in_set.biosample.badges.badge.warning",
        "experiments_in_set.biosample.badges.badge.badge_classification",
        "experiments_in_set.biosample.badges.badge.badge_icon",
        "experiments_in_set.biosample.badges.badge.description",
        "experiments_in_set.biosample.badges.messages",

        "experiments_in_set.digestion_enzyme.name",
        "experiments_in_set.filesets.files_in_set.accession",
        "experiments_in_set.last_modified.date_modified",

        # Files - For common embeds (href, file_format, etc) we could programatically get rid of a bunch of similar lines - e.g.:
        # for f in ['href', 'accession', 'file_size, ...]:
        #     ExperimentSet.embedded_list.append("experiments_in_set.files." + f)
        #     ExperimentSet.embedded_list.append("experiments_in_set.processed_files." + f) ...

        "experiments_in_set.files.href",
        "experiments_in_set.files.accession",
        "experiments_in_set.files.uuid",
        "experiments_in_set.files.file_size",
        "experiments_in_set.files.upload_key",
        "experiments_in_set.files.md5sum",
        "experiments_in_set.files.file_format",
        "experiments_in_set.files.file_type",
        "experiments_in_set.files.file_type_detailed",
        "experiments_in_set.files.file_classification",
        "experiments_in_set.files.paired_end",
        "experiments_in_set.files.status",
        "experiments_in_set.files.extra_files",
        "experiments_in_set.files.extra_files.href",
        "experiments_in_set.files.extra_files.file_format",
        "experiments_in_set.files.quality_metric.display_title",
        "experiments_in_set.files.quality_metric.Total Sequences",
        "experiments_in_set.files.quality_metric.Sequence length",
        "experiments_in_set.files.quality_metric.url",
        "experiments_in_set.files.quality_metric.overall_quality_status",
        "experiments_in_set.files.quality_metric_summary.*",  # This may not yet be enabled on raw files.
        "experiments_in_set.files.badges.badge.title",
        "experiments_in_set.files.badges.badge.commendation",
        "experiments_in_set.files.badges.badge.warning",
        "experiments_in_set.files.badges.badge.badge_classification",
        "experiments_in_set.files.badges.badge.badge_icon",
        "experiments_in_set.files.badges.badge.description",
        "experiments_in_set.files.badges.messages",
        "experiments_in_set.files.notes_to_tsv",

        "experiments_in_set.files.related_files.relationship_type",
        "experiments_in_set.files.related_files.file.accession",
        "experiments_in_set.files.related_files.file.paired_end",
        "experiments_in_set.files.related_files.file.file_type",

        "processed_files.href",
        "processed_files.accession",
        "processed_files.uuid",
        "processed_files.file_size",
        "processed_files.upload_key",
        "processed_files.file_format",
        "processed_files.file_classification",
        "processed_files.file_type",
        "processed_files.file_type_detailed",
        "processed_files.status",
        "processed_files.md5sum",
        "processed_files.extra_files",
        "processed_files.extra_files.href",
        "processed_files.extra_files.file_format",
        "processed_files.higlass_uid",
        "processed_files.genome_assembly",
        "processed_files.last_modified.date_modified",
        "processed_files.static_content.location",
        "processed_files.static_content.description",
        "processed_files.static_content.content.@type",

        # "processed_files.quality_metric.Total reads",
        # "processed_files.quality_metric.Total Sequences",
        # "processed_files.quality_metric.Sequence length",
        "processed_files.quality_metric.url",
        "processed_files.quality_metric.overall_quality_status",
        "processed_files.quality_metric_summary.*",
        "processed_files.notes_to_tsv",

        "experiments_in_set.processed_files.href",
        "experiments_in_set.processed_files.accession",
        "experiments_in_set.processed_files.uuid",
        "experiments_in_set.processed_files.file_size",
        "experiments_in_set.processed_files.upload_key",
        "experiments_in_set.processed_files.file_format",
        "experiments_in_set.processed_files.file_classification",
        "experiments_in_set.processed_files.file_type",
        "experiments_in_set.processed_files.file_type_detailed",
        "experiments_in_set.processed_files.status",
        "experiments_in_set.processed_files.md5sum",
        "experiments_in_set.processed_files.higlass_uid",
        "experiments_in_set.processed_files.genome_assembly",
        "experiments_in_set.processed_files.extra_files",
        "experiments_in_set.processed_files.extra_files.href",
        "experiments_in_set.processed_files.extra_files.file_format",
        "experiments_in_set.processed_files.quality_metric.url",
        "experiments_in_set.processed_files.quality_metric.overall_quality_status",
        "experiments_in_set.processed_files.quality_metric_summary.*",
        "experiments_in_set.processed_files.static_content.location",
        "experiments_in_set.processed_files.static_content.description",
        "experiments_in_set.processed_files.static_content.content.@type",  # Should only pull in @id, uuid, & display_title
        "experiments_in_set.processed_files.last_modified.date_modified",
        "experiments_in_set.processed_files.notes_to_tsv",
        # "experiments_in_set.processed_files.@type"

        "other_processed_files.files.accession",
        "other_processed_files.files.file_type_detailed",
        "other_processed_files.files.file_format",
        "other_processed_files.files.file_size",
        "other_processed_files.files.higlass_uid",
        "other_processed_files.files.genome_assembly",
        "other_processed_files.files.href",
        "other_processed_files.files.status",
        "other_processed_files.files.last_modified.date_modified",
        "other_processed_files.files.quality_metric.url",
        "other_processed_files.files.quality_metric.overall_quality_status",
        "other_processed_files.files.quality_metric_summary.*",
        "other_processed_files.files.notes_to_tsv",
        "other_processed_files.higlass_view_config.description",
        "other_processed_files.higlass_view_config.last_modified.date_modified",

        "experiments_in_set.other_processed_files.files.href",
        "experiments_in_set.other_processed_files.title",
        "experiments_in_set.other_processed_files.description",
        "experiments_in_set.other_processed_files.type",
        "experiments_in_set.other_processed_files.files.accession",
        "experiments_in_set.other_processed_files.files.file_type_detailed",
        "experiments_in_set.other_processed_files.files.file_format",
        "experiments_in_set.other_processed_files.files.file_size",
        "experiments_in_set.other_processed_files.files.higlass_uid",
        "experiments_in_set.other_processed_files.files.genome_assembly",
        "experiments_in_set.other_processed_files.files.status",
        "experiments_in_set.other_processed_files.files.last_modified.date_modified",
        "experiments_in_set.other_processed_files.files.quality_metric.url",
        "experiments_in_set.other_processed_files.files.quality_metric.overall_quality_status",
        "experiments_in_set.other_processed_files.files.quality_metric_summary.*",
        "experiments_in_set.other_processed_files.files.notes_to_tsv",

        "experiments_in_set.reference_files.accession",
        "experiments_in_set.reference_files.file_classification",
        "experiments_in_set.reference_files.file_type_detailed",
        "experiments_in_set.reference_files.file_size",
        "experiments_in_set.reference_files.status",

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

    @calculated_property(schema={
        "title": "Produced in Publication",
        "description": "The Publication in which this Experiment Set was produced.",
        "type": "string",
        "linkTo": "Publication"
    })
    def produced_in_pub(self, request):
        pub_paths = self.rev_link_atids(request, 'publications_produced')
        pubs = [request.embed('/', path, '@@object') for path in pub_paths]
        if pubs:
            return sorted(pubs, key=lambda pub: pub.get('date_released', pub['date_created']),
                          reverse=True)[0].get('@id')

    @calculated_property(schema={
        "title": "Publications",
        "description": "Publications associated with this Experiment Set.",
        "type": "array",
        "items": {
            "title": "Publication",
            "type": "string",
            "linkTo": "Publication"
        }
    })
    def publications_of_set(self, request):
        pubs_produced = self.rev_link_atids(request, 'publications_produced')
        pubs_using = self.rev_link_atids(request, 'publications_using')
        return list(set(pubs_produced + pubs_using))

    @calculated_property(schema={
        "title": "Number of Experiments",
        "description": "The number of Experiments in this Experiment Set.",
        "type": "integer"
    })
    def number_of_experiments(self, request, experiments_in_set=None):
        if experiments_in_set:
            return len(experiments_in_set)


@collection(
    name='experiment-set-replicates',
    unique_key='accession',
    properties={
        'title': 'Replicate Experiment Sets',
        'description': 'Experiment set covering biological and technical experiments',
    })
class ExperimentSetReplicate(ExperimentSet):
    """The experiment set class for replicate experiments."""
    base_types = ['ExperimentSet'] + Item.base_types
    item_type = 'experiment_set_replicate'
    schema = load_schema('encoded:schemas/experiment_set_replicate.json')
    name_key = "accession"
    embedded_list = ExperimentSet.embedded_list + [
        "replicate_exps.replicate_exp.accession"
    ]

    def _update(self, properties, sheets=None):
        all_experiments = [exp['replicate_exp'] for exp in properties.get('replicate_exps', [])]
        properties['experiments_in_set'] = all_experiments
        super(ExperimentSetReplicate, self)._update(properties, sheets)

    @calculated_property(schema={
        "title": "Imaging Paths",
        "type": "array",
        "items": {
            "title": "Imaging path",
            "type": "object",
            "properties": {
                "path": {
                    "title": "Imaging Path",
                    "type": "string",
                    "linkTo": "ImagingPath"
                },
                "channel": {
                    "title": "Imaging channnel",
                    "description": "channel info, ie. ch01, ch02...",
                    "type": "string",
                    "pattern": "^(ch\\d\\d)$"
                }
            }
        }
    })
    def imaging_paths(self, request, experiments_in_set=None):
        if not experiments_in_set:
            return None

        # We presume all experiments in set have the exact same imaging paths.
        # Thus we grab from 1st experiment. If not the case, this is a data issue.
        # We should have a foursight check to assert this perhaps?
        first_experiment_id = experiments_in_set[0]  # replicate_exps[0]['replicate_exp']

        if '/experiments-mic/' not in first_experiment_id:
            # We only need to check Microscopy Experiments
            return None

        first_experiment_obj = get_item_if_you_can(request, first_experiment_id, frame='raw')
        if not first_experiment_obj:  # Not yet in DB?
            return None

        return first_experiment_obj.get('imaging_paths')

    class Collection(Item.Collection):
        pass


def validate_experiment_set_replicate_experiments(context, request):
    '''
    Validates that each replicate_exps.replicate_exp in context (ExperimentSetReplicate Item)
    is unique within the ExperimentSetReplicate.
    '''
    data = request.json
    replicate_exp_objects = data.get('replicate_exps', [])
    have_seen_exps = set()
    any_failures = False
    for replicate_idx, replicate_exp_object in enumerate(replicate_exp_objects):
        experiment = replicate_exp_object.get('replicate_exp')
        if experiment in have_seen_exps:
            request.errors.add(
                'body', 'ExperimentSet: non-unique exps',
                'Duplicate experiment "' + experiment + '" defined in replicate_exps[' + str(replicate_idx) + ']'
            )
            any_failures = True
            continue
        have_seen_exps.add(experiment)

    if not any_failures:
        request.validated.update({})


@view_config(context=ExperimentSetReplicate.Collection, permission='add', request_method='POST',
             validators=[validate_item_content_post, validate_experiment_set_replicate_experiments])
@view_config(context=ExperimentSetReplicate.Collection, permission='add_unvalidated',
             request_method='POST', validators=[no_validate_item_content_post],
             request_param=['validate=false'])
@debug_log
def experiment_set_replicate_add(context, request, render=None):
    return collection_add(context, request, render)


@view_config(context=ExperimentSetReplicate, permission='edit', request_method='PUT',
             validators=[validate_item_content_put, validate_experiment_set_replicate_experiments])
@view_config(context=ExperimentSetReplicate, permission='edit', request_method='PATCH',
             validators=[validate_item_content_patch, validate_experiment_set_replicate_experiments])
@view_config(context=ExperimentSetReplicate, permission='edit_unvalidated', request_method='PUT',
             validators=[no_validate_item_content_put],
             request_param=['validate=false'])
@view_config(context=ExperimentSetReplicate, permission='edit_unvalidated', request_method='PATCH',
             validators=[no_validate_item_content_patch],
             request_param=['validate=false'])
@view_config(context=ExperimentSetReplicate, permission='index', request_method='GET',
             validators=[validate_item_content_in_place, validate_experiment_set_replicate_experiments],
             request_param=['check_only=true'])
@debug_log
def experiment_set_replicate_edit(context, request, render=None):
    return item_edit(context, request, render)
