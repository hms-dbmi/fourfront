"""The type file for the collection Individual (Encode Donor)."""
from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema,
)
from pyramid.security import Authenticated
from .base import (
    Item,
    paths_filtered_by_status,
)


@abstract_collection(
    name='individuals',
    unique_key='accession',
    properties={
        'title': "Individuals",
        'description': 'Listing of all types of individuals.',
    })
class Individual(Item):
    base_types = ['Individual'] + Item.base_types
    embedded = ['organism']
    name_key = 'accession'

    #     'characterizations',
    #     'characterizations.award',
    #     'characterizations.lab',
    #     'characterizations.submitted_by',
    #     'documents',
    #     'documents.award',
    #     'documents.lab',
    #     'documents.submitted_by'
    # ]
    # rev = {
    #     'characterizations': ('DonorCharacterization', 'characterizes'),
    # }

    # @calculated_property(schema={
    #     "title": "Characterizations",
    #     "type": "array",
    #     "items": {
    #         "type": ['string', 'object'],
    #         "linkFrom": "DonorCharacterization.characterizes",
    #     },
    # })
    # def characterizations(self, request, characterizations):
    #     return paths_filtered_by_status(request, characterizations)


@collection(
    name='individuals-human',
    unique_key='accession',
    properties={
        'title': 'Individuals-Humans',
        'description': 'Listing Biosample Human Individuals',
    })
class IndividualHuman(Individual):
    item_type = 'individual_human'
    schema = load_schema('encoded:schemas/individual_human.json')
    embedded = Individual.embedded


@collection(
    name='individuals-mouse',
    unique_key='accession',
    properties={
        'title': 'Individuals-Mice',
        'description': 'Listing Biosample Mouse Individuals',
    })
class IndividualMouse(Individual):
    item_type = 'individual_mouse'
    schema = load_schema('encoded:schemas/individual_mouse.json')
    embedded = Individual.embedded + ['mouse_vendor']

# @collection(
#     name='mouse-donors',
#     unique_key='accession',
#     acl=[],
#     properties={
#         'title': 'Mouse donors',
#         'description': 'Listing Biosample Donors',
#     })
# class MouseDonor(Donor):
#     item_type = 'mouse_donor'
#     schema = load_schema('encoded:schemas/mouse_donor.json')
#     embedded = Donor.embedded + ['references']
#
#     def __ac_local_roles__(self):
#         # Disallow lab submitter edits
#         return {Authenticated: 'role.viewing_group_member'}


# @collection(
#     name='fly-donors',
#     unique_key='accession',
#     properties={
#         'title': 'Fly donors',
#         'description': 'Listing Biosample Donors',
#     })
# class FlyDonor(Donor):
#     item_type = 'fly_donor'
#     schema = load_schema('encoded:schemas/fly_donor.json')
#     embedded = Donor.embedded + ['organism', 'constructs', 'constructs.target', 'characterizations']
#
#
# @collection(
#     name='worm-donors',
#     unique_key='accession',
#     properties={
#         'title': 'Worm donors',
#         'description': 'Listing Biosample Donors',
#     })
# class WormDonor(Donor):
#     item_type = 'worm_donor'
#     schema = load_schema('encoded:schemas/worm_donor.json')
#     embedded = Donor.embedded + ['organism', 'constructs', 'constructs.target']
