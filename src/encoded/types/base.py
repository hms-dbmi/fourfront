"""base class creation for all the schemas that exist."""
from functools import lru_cache
from pyramid.view import (
    view_config,
)
from pyramid.security import (
    # ALL_PERMISSIONS,
    Allow,
    Authenticated,
    Deny,
    # DENY_ALL,
    Everyone,
)
from pyramid.traversal import find_root
import snovault
# from ..schema_formats import is_accession
# import snovalut default post / patch stuff so we can overwrite it in this file
from snovault.validators import (
    validate_item_content_post,
    validate_item_content_put,
    validate_item_content_patch
)
from snovault.interfaces import CONNECTION
from snovault.schema_utils import SERVER_DEFAULTS
from jsonschema_serialize_fork import NO_DEFAULT

from datetime import date
import string
import re


@lru_cache()
def _award_viewing_group(award_uuid, root):
    award = root.get_by_uuid(award_uuid)
    return award.upgrade_properties().get('viewing_group')


# Item acls
ONLY_ADMIN_VIEW = [
    (Allow, 'group.admin', ['view', 'edit']),
    (Allow, 'group.read-only-admin', ['view', 'view_raw']),
    (Allow, 'remoteuser.INDEXER', ['view']),
    (Allow, 'remoteuser.EMBED', ['view']),
    (Deny, Everyone, ['view', 'edit'])
]

# This acl allows item creation; it is easily overwritten in lab and user,
# as these items should not be available for creation
SUBMITTER_CREATE = [
    (Allow, 'group.submitter', 'add'),
    (Allow, 'group.submitter', 'create')
]

ALLOW_EVERYONE_VIEW = [
    (Allow, Everyone, 'view'),
] + ONLY_ADMIN_VIEW + SUBMITTER_CREATE

ALLOW_LAB_MEMBER_VIEW = [
    (Allow, 'role.lab_member', 'view'),
] + ONLY_ADMIN_VIEW + SUBMITTER_CREATE

ALLOW_VIEWING_GROUP_VIEW = [
    (Allow, 'role.viewing_group_member', 'view'),
] + ALLOW_LAB_MEMBER_VIEW

ALLOW_VIEWING_GROUP_LAB_SUBMITTER_EDIT = [
    (Allow, 'role.viewing_group_member', 'view'),
    (Allow, 'role.lab_submitter', 'edit'),
] + ALLOW_LAB_MEMBER_VIEW

ALLOW_LAB_SUBMITTER_EDIT = [
    (Allow, 'role.lab_member', 'view'),
    (Allow, 'role.award_member', 'view'),
    (Allow, 'role.lab_submitter', 'edit'),
] + ONLY_ADMIN_VIEW + SUBMITTER_CREATE

ALLOW_CURRENT_AND_SUBMITTER_EDIT = [
    (Allow, Everyone, 'view'),
    (Allow, 'role.lab_submitter', 'edit'),
] + ONLY_ADMIN_VIEW + SUBMITTER_CREATE

ALLOW_CURRENT = ALLOW_EVERYONE_VIEW

DELETED = [
    (Deny, Everyone, 'visible_for_edit')
] + ONLY_ADMIN_VIEW

# For running pipelines
ALLOW_LAB_VIEW_ADMIN_EDIT = [
    (Allow, 'role.lab_member', 'view'),
    (Allow, 'role.award_member', 'view'),
    (Allow, 'role.lab_submitter', 'view'),
] + ONLY_ADMIN_VIEW

ALLOW_OWNER_EDIT = [
    (Allow, 'role.owner', ['edit', 'view', 'view_details']),
]

# Collection acls
ALLOW_SUBMITTER_ADD = SUBMITTER_CREATE

ALLOW_ANY_USER_ADD = [
    (Allow, Authenticated, 'add'),
    (Allow, Authenticated, 'create')
] + ALLOW_EVERYONE_VIEW


def get_item_if_you_can(request, value, itype=None, frame='object'):
    """
    Return the view of an item with given frame. Can specify different types
    of `value` for item lookup

    Args:
        request: the current Request
        value (str): String item identifier or a dict containing @id/uuid
        itype (str): Optional string collection name for the item (e.g. /file-formats/)
        frame (str): Optional frame to return. Defaults to 'object'

    Returns:
        dict: given view of the item or None on failure
    """
    item = None

    if isinstance(value, dict):
        if 'uuid' in value:
            value = value['uuid']
        elif '@id' in value:
            value = value['@id']

    svalue = str(value)

    # Below case is for UUIDs & unique_keys such as accessions, but not @ids
    if not svalue.startswith('/') and not svalue.endswith('/'):
        svalue = '/' + svalue + '/'
        if itype is not None:
            svalue = '/' + itype + svalue

    # Request.embed will attempt to get from ES for frame=object/embedded
    # If that fails, get from DB. Use '@@' syntax instead of 'frame=' because
    # these paths are cached in indexing
    try:
        item = request.embed(svalue, '@@' + frame)
    except:
        pass

    # could lead to unexpected errors if == None
    return item


def set_namekey_from_title(properties):
    name = None
    if properties.get('title'):
        exclude = set(string.punctuation.replace('-', ''))
        name = properties['title'].replace('&', ' n ')
        name = ''.join(ch if ch not in exclude and ch != ' ' else '-' for ch in name)
        name = re.sub(r"[-]+", '-', name).strip('-').lower()
    return name


def validate_item_type_of_linkto_field(context, request):
    """We are doing this case by case on item specific types files,
    but might want to carry it here if filter is used more often.
    If any of the submitted fields contain an ff_flag property starting with "filter",
    the field in the filter is used for validating the type of the linked item.
    Example: file has field file_format which is a linkTo FileFormat.
    FileFormat items contain a field called "valid_item_types".
    We have the ff_flag on file_format field called "filter:valid_item_types"."""
    pass


##
## Common lists of embeds to be re-used in certain files (similar to schema mixins)
##

static_content_embed_list = [
    "static_headers.*",            # Type: UserContent, may have differing properties
    "static_content.content.@type",
    "static_content.content.content",
    "static_content.content.name",
    "static_content.content.title",
    "static_content.content.status",
    "static_content.content.description",
    "static_content.content.options",
    "static_content.content.lab",
    "static_content.content.contributing_labs",
    "static_content.content.award",
    "static_content.content.filetype"
]

lab_award_attribution_embed_list = [
    "award.project",
    "award.center_title",
    "lab.city",
    "lab.state",
    "lab.country",
    "lab.postal_code",
    "lab.city",
    "lab.display_title",
    "lab.url",
    "lab.correspondence",                                # Not a real linkTo - temp workaround
    "contributing_labs.correspondence",                  # Not a real linkTo - temp workaround
    "submitted_by.timezone",
    "submitted_by.job_title"
]


class AbstractCollection(snovault.AbstractCollection):
    """smth."""

    def __init__(self, *args, **kw):
        try:
            self.lookup_key = kw.pop('lookup_key')
        except KeyError:
            pass
        super(AbstractCollection, self).__init__(*args, **kw)

    def get(self, name, default=None):
        '''
        heres' and example of why this is the way it is:
        ontology terms have uuid or term_id as unique ID keys
        and if neither of those are included in post, try to
        use term_name such that:
        No - fail load with non-existing term message
        Multiple - fail load with ‘ambiguous name - more than 1 term with that name exist use ID’
        Single result - get uuid and use that for post/patch
        '''
        resource = super(AbstractCollection, self).get(name, None)
        if resource is not None:
            return resource
        if ':' in name:
            resource = self.connection.get_by_unique_key('alias', name)
            if resource is not None:
                if not self._allow_contained(resource):
                    return default
                return resource
        if getattr(self, 'lookup_key', None) is not None:
            # lookup key translates to query json by key / value and return if only one of the
            # item type was found... so for keys that are mostly unique, but do to whatever
            # reason (bad data mainly..) can be defined as unique keys
            item_type = self.type_info.item_type
            resource = self.connection.get_by_json(self.lookup_key, name, item_type)
            if resource is not None:
                if not self._allow_contained(resource):
                    return default
                return resource
        return default


class Collection(snovault.Collection, AbstractCollection):
    """smth."""

    def __init__(self, *args, **kw):
        """smth."""
        super(Collection, self).__init__(*args, **kw)
        if hasattr(self, '__acl__'):
            return
        # XXX collections should be setup after all types are registered.
        # Don't access type_info.schema here as that precaches calculated schema too early.
        if 'lab' in self.type_info.factory.schema['properties']:
            self.__acl__ = ALLOW_SUBMITTER_ADD


@snovault.abstract_collection(
    name='items',
    properties={
        'title': "Item Listing",
        'description': 'Abstract collection of all Items.',
    })
class Item(snovault.Item):
    """
    The abstract base type for all other Items.
    All methods & properties are inherited by
    sub-types unless overridden.
    """
    item_type = 'item'
    AbstractCollection = AbstractCollection
    Collection = Collection
    STATUS_ACL = {
        # standard_status
        'released': ALLOW_CURRENT,
        'current': ALLOW_CURRENT,
        'revoked': ALLOW_CURRENT,
        'archived': ALLOW_CURRENT,
        'deleted': DELETED,
        'replaced': ALLOW_CURRENT,
        'planned': ALLOW_VIEWING_GROUP_LAB_SUBMITTER_EDIT,
        'in review by lab': ALLOW_LAB_SUBMITTER_EDIT,
        'submission in progress': ALLOW_VIEWING_GROUP_LAB_SUBMITTER_EDIT,
        'released to project': ALLOW_VIEWING_GROUP_VIEW,
        'archived to project': ALLOW_VIEWING_GROUP_VIEW,
        # for file
        'obsolete': DELETED,
        'uploading': ALLOW_LAB_SUBMITTER_EDIT,
        'to be uploaded by workflow': ALLOW_LAB_SUBMITTER_EDIT,
        'uploaded': ALLOW_LAB_SUBMITTER_EDIT,
        'upload failed': ALLOW_LAB_SUBMITTER_EDIT,
        'restricted': ALLOW_CURRENT,
        # publication
        'published': ALLOW_CURRENT,
        # experiment sets
        'pre-release': ALLOW_LAB_VIEW_ADMIN_EDIT
    }

    # Items of these statuses are filtered out from rev links
    filtered_rev_statuses = ('deleted', 'replaced')

    # Default embed list for all 4DN Items
    embedded_list = static_content_embed_list

    def __init__(self, registry, models):
        super().__init__(registry, models)
        self.STATUS_ACL = self.__class__.STATUS_ACL

    @property
    def __name__(self):
        """smth."""
        if self.name_key is None:
            return self.uuid
        properties = self.upgrade_properties()
        if properties.get('status') == 'replaced':
            return self.uuid
        return properties.get(self.name_key, None) or self.uuid

    def __acl__(self):
        """smth."""
        # Don't finalize to avoid validation here.
        properties = self.upgrade_properties().copy()
        status = properties.get('status')
        return self.STATUS_ACL.get(status, ALLOW_LAB_SUBMITTER_EDIT)

    def __ac_local_roles__(self):
        """this creates roles based on properties of the object being acccessed"""

        def _is_joint_analysis(props):
            for t in props.get('tags', []):
                if 'joint analysis' in t.lower():
                    return True
            return False

        roles = {}
        properties = self.upgrade_properties()
        if 'lab' in properties:
            lab_submitters = 'submits_for.%s' % properties['lab']
            roles[lab_submitters] = 'role.lab_submitter'
            # add lab_member as well
            lab_member = 'lab.%s' % properties['lab']
            roles[lab_member] = 'role.lab_member'
        if 'contributing_labs' in properties:
            for clab in properties['contributing_labs']:
                clab_member = 'lab.%s' % clab
                roles[clab_member] = 'role.lab_member'
        if 'award' in properties:
            viewing_group = _award_viewing_group(properties['award'], find_root(self))
            if viewing_group is not None:
                viewing_group_members = 'viewing_group.%s' % viewing_group
                roles[viewing_group_members] = 'role.viewing_group_member'
                award_group_members = 'award.%s' % properties['award']
                roles[award_group_members] = 'role.award_member'

                status = properties.get('status')
                # need to add 4DN viewing_group to NOFIC items that are rel2proj
                # or are JA and planned or in progress
                if viewing_group == 'NOFIC':
                    if status == 'released to project':
                        roles['viewing_group.4DN'] = 'role.viewing_group_member'
                    elif status in ['planned', 'submission in progress']:
                        if _is_joint_analysis(properties):
                            roles['viewing_group.4DN'] = 'role.viewing_group_member'
                    # else leave the NOFIC viewing group role in place
                elif status in ['planned', 'submission in progress'] and not _is_joint_analysis(properties):
                    # view should be restricted to lab members only so remove viewing_group roles
                    grps = []
                    for group, role in roles.items():
                        if role == 'role.viewing_group_member':
                            grps.append(group)
                    for g in grps:
                        del roles[g]
        # This emulates __ac_local_roles__ of User.py (role.owner)
        if 'submitted_by' in properties:
            submitter = 'userid.%s' % properties['submitted_by']
            roles[submitter] = 'role.owner'
        return roles

    def add_accession_to_title(self, title):
        if self.properties.get('accession') is not None:
            return title + ' - ' + self.properties.get('accession')
        return title

    def unique_keys(self, properties):
        """smth."""
        keys = super(Item, self).unique_keys(properties)
        if 'accession' not in self.schema['properties']:
            return keys
        keys.setdefault('accession', []).extend(properties.get('alternate_accessions', []))
        if properties.get('status') != 'replaced' and 'accession' in properties:
            keys['accession'].append(properties['accession'])
        return keys

    def is_update_by_admin_user(self):
        # determine if the submitter in the properties is an admin user
        userid = SERVER_DEFAULTS['userid']('blah', 'blah')
        users = self.registry['collections']['User']
        user = users.get(userid)
        if 'groups' in user.properties:
            if 'admin' in user.properties['groups']:
                return True
        return False

    def _update(self, properties, sheets=None):
        props = {}
        try:
            props = self.properties
        except KeyError:
            pass
        if 'status' in props and props['status'] == 'planned':
            # if an item is status 'planned' and an update is submitted
            # by a non-admin user then status should be changed to 'submission in progress'
            if not self.is_update_by_admin_user():
                properties['status'] = 'submission in progress'

        try:  # update last_modified. this depends on an available request
            last_modified = {
                'modified_by': SERVER_DEFAULTS['userid']('blah', 'blah'),
                'date_modified': SERVER_DEFAULTS['now']('blah', 'blah')
            }
        except AttributeError:
            pass
        else:
            # SERVER_DEFAULTS['userid'] returns NO_DEFAULT if no userid
            if last_modified['modified_by'] != NO_DEFAULT:
                properties['last_modified'] = last_modified

        date2status = [{'public_release': ['released', 'current']}, {'project_release': ['released to project']}]
        # if an item is directly released without first being released to project
        # then project_release date is added for same date as public_release
        for dateinfo in date2status:
            datefield, statuses = next(iter(dateinfo.items()))
            if datefield not in props:
                if datefield in self.schema['properties'] and datefield not in properties:
                    if 'status' in properties and properties['status'] in statuses:
                        # check the status and add the date if it's not provided and item has right status
                        properties[datefield] = date.today().isoformat()
                    elif datefield == 'project_release':
                        # case where public_release is added and want to set project_release = public_release
                        public_rel = properties.get('public_release')
                        if public_rel:
                            properties[datefield] = public_rel

        super(Item, self)._update(properties, sheets)

    @snovault.calculated_property(schema={
        "title": "External Reference URIs",
        "description": "External references to this item.",
        "type": "array",
        "items": {
            "type": "object", "title": "External Reference", "properties": {
                "uri": {"type": "string"},
                "ref": {"type": "string"}
            }
        }
    })
    def external_references(self, request, dbxrefs=None):
        namespaces = request.registry.settings.get('snovault.jsonld.namespaces')
        if dbxrefs and namespaces:
            refs = []
            for r in dbxrefs:
                refObject = {"ref": r, "uri": None}
                refParts = r.split(':')
                if len(refParts) < 2:
                    refs.append(refObject)
                    continue
                refPrefix = refParts[0]
                refID = refParts[1]
                baseUri = namespaces.get(refPrefix)
                if not baseUri:
                    refs.append(refObject)
                    continue

                if '{reference_id}' in baseUri:
                    refObject['uri'] = baseUri.replace('{reference_id}', refID, 1)
                else:
                    refObject['uri'] = baseUri + refID
                refs.append(refObject)

            return refs
        return []

    @snovault.calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    },)
    def display_title(self, request=None):
        """create a display_title field."""
        display_title = ""
        look_for = [
            "title",
            "name",
            "location_description",
            "accession",
        ]
        properties = self.upgrade_properties()
        for field in look_for:
            # special case for user: concatenate first and last names
            display_title = properties.get(field, None)
            if display_title:
                if field != 'accession':
                    display_title = self.add_accession_to_title(display_title)
                return display_title
        # if none of the existing terms are available, use @type + date_created
        try:
            type_date = self.__class__.__name__ + " from " + properties.get("date_created", None)[:10]
            return type_date
        # last resort, use uuid
        except:
            return properties.get('uuid', None)

    def rev_link_atids(self, request, rev_name):
        """
        Returns the list of reverse linked items given a defined reverse link,
        which should be formatted like:
        rev = {
            '<reverse field name>': ('<reverse item class>', '<reverse field to find>'),
        }

        """
        conn = request.registry[CONNECTION]
        return [request.resource_path(conn[uuid]) for uuid in
                self.get_filtered_rev_links(request, rev_name)]


class SharedItem(Item):
    """An Item visible to all authenticated users while "proposed" or "in progress"."""

    def __ac_local_roles__(self):
        """smth."""
        roles = {}
        properties = self.upgrade_properties().copy()
        if 'lab' in properties:
            lab_submitters = 'submits_for.%s' % properties['lab']
            roles[lab_submitters] = 'role.lab_submitter'
        roles[Authenticated] = 'role.viewing_group_member'
        return roles


@snovault.calculated_property(context=Item.AbstractCollection, category='action')
def add(context, request):
    """smth."""
    if request.has_permission('add', context):
        type_name = context.type_info.name
        return {
            'name': 'add',
            'title': 'Add',
            'profile': '/profiles/{name}.json'.format(name=type_name),
            'href': '/search/?type={name}&currentAction=add'.format(name=type_name),
        }


@snovault.calculated_property(context=Item, category='action')
def edit(context, request):
    """smth."""
    if request.has_permission('edit'):
        return {
            'name': 'edit',
            'title': 'Edit',
            'profile': '/profiles/{ti.name}.json'.format(ti=context.type_info),
            'href': '{item_uri}?currentAction=edit'.format(item_uri=request.resource_path(context)),
        }


@snovault.calculated_property(context=Item, category='action')
def create(context, request):
    """If the user submits for any lab, allow them to create"""
    if request.has_permission('create'):
        return {
            'name': 'create',
            'title': 'Create',
            'profile': '/profiles/{ti.name}.json'.format(ti=context.type_info),
            'href': '{item_uri}?currentAction=create'.format(item_uri=request.resource_path(context)),
        }
