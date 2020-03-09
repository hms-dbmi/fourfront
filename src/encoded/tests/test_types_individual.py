import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def mouse_child(testapp, mouse, lab, award):
    return {
        'uuid': '4731449b-f283-4fdf-ad8a-b69cf5a7e68a',
        'award': award['@id'],
        'lab': lab['@id'],
        'organism': mouse['@id'],
        "sex": "female",
    }


@pytest.fixture
def mouse_individual_2(testapp, mouse, lab, award):
    item = {
        'uuid': 'd89c5c5b-a427-4efa-b6da-44239d92f2e7',
        "age": 99,
        "age_units": "day",
        'award': award['@id'],
        'lab': lab['@id'],
        'organism': mouse['@id'],
        "mouse_strain": "Balb-c",
        "mouse_life_stage": "adult",
        "sex": "male",
    }
    return testapp.post_json('/individual_mouse', item).json['@graph'][0]


def test_validate_individual_relation_valid_post(testapp, award, lab, mouse_individual, mouse_child):
    mouse_child['individual_relation'] = [
        {'relationship_type': 'derived from', 'individual': mouse_individual['@id']}]
    res = testapp.post_json('/individual_mouse', mouse_child, status=201)
    assert not res.json.get('errors')


def test_validate_individual_relation_species(testapp, award, lab, mouse_child, human_individual):
    mouse_child['individual_relation'] = [{'relationship_type': 'derived from', 'individual': human_individual['@id']}]
    res = testapp.post_json('/individual_mouse', mouse_child, status=422)
    errors = res.json['errors']
    assert errors[0]['name'] == 'Individual relation: different species'


def test_validate_individual_relation_valid_patch(testapp, award, lab, mouse_child, mouse_individual, mouse_individual_2):
    res = testapp.post_json('/individual_mouse', mouse_child, status=201)
    assert not res.json.get('errors')
    patch_body = {
        'individual_relation': [
            {'relationship_type': 'derived from', 'individual': mouse_individual['@id']},
            {'relationship_type': 'derived from', 'individual': mouse_individual_2['@id']}
        ]
    }
    res2 = testapp.patch_json(res.json['@graph'][0]['@id'], patch_body, status=200)
    assert not res2.json.get('errors')


def test_validate_individual_relation_valid_patch_contains_uuid(testapp, award, lab, mouse_child, mouse_individual, mouse_individual_2):
    child_mouse = testapp.post_json('/individual_mouse', mouse_child, status=201).json['@graph'][0]
    patch_body = {
        'uuid': child_mouse.get('uuid'),
        'individual_relation': [
            {'relationship_type': 'derived from', 'individual': mouse_individual['@id']},
            {'relationship_type': 'derived from', 'individual': mouse_individual_2['@id']}
        ]
    }
    res2 = testapp.patch_json(child_mouse['@id'], patch_body, status=200)
    assert not res2.json.get('errors')


def test_validate_individual_relation_self(testapp, award, lab, mouse_child):
    res = testapp.post_json('/individual_mouse', mouse_child, status=201)
    assert not res.json.get('errors')
    patch_body = [{'relationship_type': 'derived from', 'individual': res.json['@graph'][0]['@id']}]
    res2 = testapp.patch_json(res.json['@graph'][0]['@id'], {'individual_relation': patch_body}, status=422)
    errors = res2.json['errors']
    assert errors[0]['name'] == 'Individual relation: self-relation'


def test_validate_individual_relation_same(testapp, award, lab, mouse_individual, mouse_individual_2, mouse_child):
    mouse_child['individual_relation'] = [
        {'relationship_type': 'derived from (maternal strain)', 'individual': mouse_individual['@id']},
        {'relationship_type': 'derived from (maternal strain)', 'individual': mouse_individual_2['@id']}]
    res = testapp.post_json('/individual_mouse', mouse_child, status=422)
    errors = res.json['errors']
    assert errors[0]['name'] == 'Individual relation: too many of the same type'


def test_validate_individual_relation_duplicate(testapp, award, lab, mouse_individual, mouse_child):
    mouse_child['individual_relation'] = [
        {'relationship_type': 'derived from', 'individual': mouse_individual['@id']},
        {'relationship_type': 'derived from (maternal strain)', 'individual': mouse_individual['@id']}]
    res = testapp.post_json('/individual_mouse', mouse_child, status=422)
    errors = res.json['errors']
    assert errors[0]['name'] == 'Individual relation: multiple relations with same parent'
