import pytest
pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def genomic_region_w_onlyendloc(testapp, lab, award):
    item = {
        "genome_assembly": "assembly",
        "end_coordinate": 3,
        'award': award['@id'],
        'lab': lab['@id']
    }
    return testapp.post_json('/genomic_region', item).json['@graph'][0]


@pytest.fixture
def genomic_regions(genomic_region_w_onlyendloc, genomic_region_w_chrloc, basic_genomic_region, lab, award):
    return {'genomic_region_w_onlyendloc': genomic_region_w_onlyendloc,
            'genomic_region_w_chrloc': genomic_region_w_chrloc,
            'basic_genomic_region': basic_genomic_region,
            'award': award['@id'],
            'lab': lab['@id']
            }


@pytest.fixture
def targets(target_w_desc, target_w_region, target_w_genes):
    return {'target_w_desc': target_w_desc,
            'target_w_region': target_w_region,
            'target_w_genes': target_w_genes
            }


def test_calculated_target_summaries(testapp, targets):
    for name in targets:
        summary = targets[name]['target_summary']
        short = targets[name]['target_summary_short']
        if name == 'target_w_genes':
            assert summary == 'Gene:eeny, meeny'
            assert short == 'Gene:eeny, meeny'
        if name == 'target_w_regions' in targets:
            assert summary == 'GRCh38:X:1-3'
            assert short == 'no target'
        if name == 'target_w_desc':
            assert summary == 'no target'
            assert short == "I'm a region"


@pytest.fixture
def protocol_data(lab, award):
    return {
        'lab': lab['@id'],
        'award': award['@id'],
        'protocol_type': 'Experimental protocol',
        'description': 'Test Protocol'
    }


@pytest.fixture
def protocol_w_attach(testapp, protocol_data, attachment):
    protocol_data['attachment'] = attachment
    return testapp.post_json('/protocol', protocol_data).json['@graph'][0]


def test_protocol_display_title_w_attachment(testapp, protocol_w_attach):
    assert protocol_w_attach['display_title'] == 'red-dot.png'


def test_protocol_display_title_wo_attachment(testapp, protocol_data):
    from datetime import datetime
    protocol = testapp.post_json('/protocol', protocol_data).json['@graph'][0]
    assert protocol['display_title'] == 'Experimental protocol from ' + str(datetime.now())[:10]


def test_protocol_other_display_title_wo_attachment(testapp, protocol_data):
    from datetime import datetime
    protocol_data['protocol_type'] = 'Other'
    protocol = testapp.post_json('/protocol', protocol_data).json['@graph'][0]
    assert protocol['display_title'] == 'Protocol from ' + str(datetime.now())[:10]


@pytest.fixture
def antibody_data(lab, award):
    return {
        'lab': lab['@id'],
        'award': award['@id'],
        'description': 'Test Antibody',
        'antibody_name': 'testAb'
    }


@pytest.fixture
def ab_w_name(testapp, antibody_data):
    return testapp.post_json('/antibody', antibody_data).json['@graph'][0]


def test_antibody_display_title_name_only(ab_w_name):
    assert ab_w_name['display_title'] == 'testAb'


def test_antibody_display_title_name_and_accession(testapp, ab_w_name):
    acc = 'ENCAB111AAA'
    res = testapp.patch_json(ab_w_name['@id'], {'antibody_product_no': acc}).json['@graph'][0]
    assert res['display_title'] == 'testAb (' + acc + ')'
