"""The type file for the collection Individual (Encode Donor)."""
from snovault import (
    abstract_collection,
    # calculated_property,
    collection,
    load_schema,
)
# from pyramid.security import Authenticated
from .base import (
    Item,
    ALLOW_SUBMITTER_ADD,
    get_item_if_you_can,
    lab_award_attribution_embed_list
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


@abstract_collection(
    name='individuals',
    unique_key='accession',
    acl=ALLOW_SUBMITTER_ADD,
    properties={
        'title': "Individuals",
        'description': 'Listing of all types of individuals.',
    })
class Individual(Item):
    """the base class for individual collection."""
    item_type = 'individual'
    base_types = ['Individual'] + Item.base_types
    schema = load_schema('encoded:schemas/individual.json')
    embedded_list = Item.embedded_list + lab_award_attribution_embed_list + ['organism.name']
    name_key = 'accession'

    class Collection(Item.Collection):
        pass


@collection(
    name='individuals-human',
    unique_key='accession',
    properties={
        'title': 'Individuals-Humans',
        'description': 'Listing Biosample Human Individuals',
    })
class IndividualHuman(Individual):
    """the sub class of individuals for human species."""

    item_type = 'individual_human'
    schema = load_schema('encoded:schemas/individual_human.json')
    embedded_list = Individual.embedded_list


@collection(
    name='individuals-primate',
    unique_key='accession',
    properties={
        'title': 'Individuals-Primates',
        'description': 'Listing Biosample Primate Individuals',
    })
class IndividualPrimate(Individual):
    """the sub class of individuals for primate species."""

    item_type = 'individual_primate'
    schema = load_schema('encoded:schemas/individual_primate.json')
    embedded_list = Individual.embedded_list


@collection(
    name='individuals-mouse',
    unique_key='accession',
    properties={
        'title': 'Individuals-Mice',
        'description': 'Listing Biosample Mouse Individuals',
    })
class IndividualMouse(Individual):
    """the sub class of individuals for mouse species."""

    item_type = 'individual_mouse'
    schema = load_schema('encoded:schemas/individual_mouse.json')
    embedded_list = Individual.embedded_list + ['mouse_vendor.name']


@collection(
    name='individuals-fly',
    unique_key='accession',
    properties={
        'title': 'Individuals-Flies',
        'description': 'Listing Biosample Fly Individuals',
    })
class IndividualFly(Individual):
    """the sub class of individuals for flies."""

    item_type = 'individual_fly'
    schema = load_schema('encoded:schemas/individual_fly.json')
    embedded_list = Individual.embedded_list + ['fly_vendor.name']


@collection(
    name='individuals-chicken',
    unique_key='accession',
    properties={
        'title': 'Individuals-Chickens',
        'description': 'Listing Biosample Chicken Individuals',
    })
class IndividualChicken(Individual):
    """the sub class of individuals for chickens."""

    item_type = 'individual_chicken'
    schema = load_schema('encoded:schemas/individual_chicken.json')
    embedded_list = Individual.embedded_list + ['chicken_vendor.name']


@collection(
    name='individuals-zebrafish',
    unique_key='accession',
    properties={
        'title': 'Individuals-Zebrafish',
        'description': 'Listing Zebrafish Sources',
    })
class IndividualZebrafish(Individual):
    """the sub class of individuals for zebrafish."""

    item_type = 'individual_zebrafish'
    schema = load_schema('encoded:schemas/individual_zebrafish.json')
    embedded_list = Individual.embedded_list + ['zebrafish_vendor.name']


# validator for individual relations - same species
def validate_individual_relations(context, request):
    '''Validates that individual relations are within the same species,
    limited to two relations per individual (max 1 paternal and 1 maternal),
    not self relations, and unique (no duplicate relations).
    '''
    related_individuals = request.json.get('individual_relation')  # a list of dicts
    if related_individuals is None:
        return
    any_failures = False

    # check if the individual info is in request (POST) or in context (PATCH)
    try:
        individual_uuid = str(context.uuid)
        data = context.properties
    except AttributeError:
        data = request.json
        individual_uuid = data.get('uuid')
    organism_id = data.get('organism')
    organism = get_item_if_you_can(request, organism_id, 'organisms')

    # Max 2 parents per individual
    if len(related_individuals) > 2:
        request.errors.add(
            'body', 'Individual relation: too many parents',
            'An individual cannot have more than two parents'
        )
        any_failures = True

    relations_counter = {}
    relations_unique = {}
    for a_related_individual in related_individuals:
        if len(a_related_individual.keys()) < 2:
            continue
        parent = a_related_individual.get('individual')
        parent_props = get_item_if_you_can(request, parent, 'individuals')
        parent_organism = get_item_if_you_can(request, parent_props.get('organism'), 'organisms')
        parent_uuid = parent_props.get('uuid')

        # Same species
        if parent_organism.get('uuid') != organism.get('uuid'):
            request.errors.add(
                'body', 'Individual relation: different species',
                'Parent individual is ' + parent_organism['name'] + ', not ' + organism['name']
            )
            any_failures = True

        # Self relation
        if parent_uuid == individual_uuid:
            request.errors.add(
                'body', 'Individual relation: self-relation',
                'An individual cannot be related to itself'
            )
            any_failures = True

        # Count of relationship type, excluding the generic 'derived from'
        rel_type = a_related_individual['relationship_type']
        if rel_type != 'derived from':
            if rel_type in relations_counter.keys():
                relations_counter[rel_type] += 1
            else:
                relations_counter[rel_type] = 1

        # Multiple relations with same parent
        if parent_uuid in relations_unique.keys():
            relations_unique[parent_uuid] += 1
        else:
            relations_unique[parent_uuid] = 1

    if any(a_value > 1 for a_value in relations_counter.values()):
        request.errors.add(
            'body', 'Individual relation: too many of the same type',
            'An individual cannot derive from more than one maternal or paternal strain'
        )
        any_failures = True

    if any(val > 1 for val in relations_unique.values()):
        request.errors.add(
            'body', 'Individual relation: multiple relations with same parent',
            'An individual cannot have more than one relation with the same parent'
        )
        any_failures = True

    if not any_failures:
        request.validated.update({})


@view_config(context=Individual.Collection, permission='add', request_method='POST',
             validators=[validate_item_content_post, validate_individual_relations])
@view_config(context=Individual.Collection, permission='add_unvalidated', request_method='POST',
             validators=[no_validate_item_content_post],
             request_param=['validate=false'])
def individual_add(context, request, render=None):
    return collection_add(context, request, render)


@view_config(context=Individual, permission='edit', request_method='PUT',
             validators=[validate_item_content_put, validate_individual_relations])
@view_config(context=Individual, permission='edit', request_method='PATCH',
             validators=[validate_item_content_patch, validate_individual_relations])
@view_config(context=Individual, permission='edit_unvalidated', request_method='PUT',
             validators=[no_validate_item_content_put],
             request_param=['validate=false'])
@view_config(context=Individual, permission='edit_unvalidated', request_method='PATCH',
             validators=[no_validate_item_content_patch],
             request_param=['validate=false'])
@view_config(context=Individual, permission='index', request_method='GET',
             validators=[validate_item_content_in_place, validate_individual_relations],
             request_param=['check_only=true'])
def individual_edit(context, request, render=None):
    return item_edit(context, request, render)
