"""The type file for the collection Award.

"""
from pyramid.security import (
    Allow,
    Deny,
    Everyone,
)

from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)
import re


@collection(
    name='awards',
    unique_key='award:name',
    properties={
        'title': 'Awards (Grants)',
        'description': 'Listing of awards (aka grants)',
    })
class Award(Item):
    """Award class."""

    item_type = 'award'
    schema = load_schema('encoded:schemas/award.json')
    name_key = 'name'
    embedded_list = Item.embedded_list + ['pi.*']

    # define some customs acls; awards can only be created/edited by admin
    ONLY_ADMIN_VIEW = [
        (Allow, 'group.admin', ['view', 'edit']),
        (Allow, 'group.read-only-admin', ['view', 'view_raw']),
        (Allow, 'remoteuser.INDEXER', ['view']),
        (Allow, 'remoteuser.EMBED', ['view']),
        (Deny, Everyone, ['view', 'edit'])
    ]

    SUBMITTER_CREATE = []

    ALLOW_EVERYONE_VIEW = [
        (Allow, Everyone, 'view'),
    ]

    ALLOW_EVERYONE_VIEW_AND_ADMIN_EDIT = [
        (Allow, Everyone, 'view'),
    ] + ONLY_ADMIN_VIEW

    STATUS_ACL = {
        'current': ALLOW_EVERYONE_VIEW_AND_ADMIN_EDIT,
        'deleted': ONLY_ADMIN_VIEW,
        'revoked': ALLOW_EVERYONE_VIEW,
        'replaced': ALLOW_EVERYONE_VIEW,
        'inactive': ALLOW_EVERYONE_VIEW
    }

    @calculated_property(schema={
        "title": "Center Title",
        "description": "A center facet for every award",
        "type": "string"
    })
    def center_title(self, request, name, description=None, center='', pi=None):
        '''If a center is not present for award then looks for classification
           of award by checking beginning of description, adds the pi last name
           if present or defaults to required award number
        '''
        if center:
            return center
        if description:
            m = re.match('[A-Z]+:', description)
            if m:
                center += m.group()[:-1]
        if pi:
            pi = request.embed(pi, '@@object')
            if center:
                center += ' - '
            center += pi.get('last_name')
        if not center:
            # default to award number
            center = name
        return center
