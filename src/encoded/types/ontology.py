"""Collection for the Ontology and OntologyTerms objects."""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='ontology-terms',
    unique_key='ontology_term:term_id',
    lookup_key='term_name',
    properties={
        'title': 'Ontology Terms',
        'description': 'Listing of Ontology Terms',
    })
class OntologyTerm(Item):
    """The OntologyTerm class that holds info on a term from an ontology."""

    item_type = 'ontology_term'
    schema = load_schema('encoded:schemas/ontology_term.json')
    embedded_list = ['slim_terms.is_slim_for', 'slim_terms.term_name', 'source_ontology.ontology_name']
    name_key = 'term_id'

    def _update(self, properties, sheets=None):
        '''set preferred_name field to term_name if it's not already populated
        '''
        # import pdb; pdb.set_trace()
        if properties.get('preferred_name', None) is None:
            termname = properties.get('term_name')
            if termname:
                properties['preferred_name'] = termname

        super(OntologyTerm, self)._update(properties, sheets)

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, term_id, preferred_name=None, term_name=None):
        if preferred_name is not None:
            return preferred_name
        if term_name is not None:
            return term_name
        return term_id


@collection(
    name='ontologys',
    unique_key='ontology:ontology_prefix',
    properties={
        'title': 'Ontologies',
        'description': 'Listing of Ontologies',
    })
class Ontology(Item):
    """The Ontology class that holds info on an ontology."""

    item_type = 'ontology'
    schema = load_schema('encoded:schemas/ontology.json')
    embedded_list = [
        'synonym_terms.*',
        'definition_terms.*',
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, ontology_name):
        return ontology_name
