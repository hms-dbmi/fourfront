import argparse
import structlog
import logging

from pyramid.paster import get_app
from snovault.elasticsearch.create_mapping import run as run_create_mapping
from dcicutils.log_utils import set_logging
from dcicutils.beanstalk_utils import whodaman

log = structlog.getLogger(__name__)
EPILOG = __doc__

# This order determines order that items will be mapped + added to the queue
# Can use item type (e.g. file_fastq) or class name (e.g. FileFastq)
ITEM_INDEX_ORDER = [
    'Award',
    'Lab',
    'AccessKey',
    'User',

    'Ontology',
    'OntologyTerm',

    'StaticSection',
    'Document',
    'Protocol',

    'FileFormat',
    'ExperimentType',

    'Vendor',
    'Organism',

    'Gene',
    'GenomicRegion',
    'BioFeature',
    'Target',

    'Construct',
    'Enzyme',
    'Antibody',

    'FileReference',

    'IndividualChicken',
    'IndividualFly',
    'IndividualHuman',
    'IndividualMouse',
    'IndividualPrimate',
    'IndividualZebrafish',

    'Image',
    'Modification',

    'Biosource',
    'BiosampleCellCulture',
    'Biosample',

    'Workflow',
    'WorkflowMapping',

    'PublicationTracking',
    'Software',
    'AnalysisStep',
    'Badge',
    'SopMap',
    'SummaryStatistic',
    'SummaryStatisticHiC',
    'TrackingItem',

    'TreatmentAgent',
    'TreatmentRnai',

    'ImagingPath',
    'MicroscopeSettingA1',
    'MicroscopeSettingA2',
    'MicroscopeSettingD1',
    'MicroscopeSettingD2',
    'MicroscopeConfiguration',

    'HiglassViewConfig',
    'QualityMetricAtacseq',
    'QualityMetricBamqc',
    'QualityMetricBamcheck',
    'QualityMetricChipseq',
    'QualityMetricDedupqcRepliseq',
    'QualityMetricFastqc',
    'QualityMetricFlag',
    'QualityMetricPairsqc',
    'QualityMetricMargi',
    'QualityMetricRnaseq',
    'QualityMetricWorkflowrun',

    'ExperimentAtacseq',
    'ExperimentCaptureC',
    'ExperimentChiapet',
    'ExperimentDamid',
    'ExperimentHiC',
    'ExperimentMic',
    'ExperimentRepliseq',
    'ExperimentSeq',
    'ExperimentTsaseq',
    'ExperimentSet',
    'ExperimentSetReplicate',

    'Publication',

    'FileCalibration',
    'FileFastq',
    'FileMicroscopy',
    'FileProcessed',
    'FileSet',
    'FileSetCalibration',
    'FileSetMicroscopeQc',
    'FileVistrack',

    'DataReleaseUpdate',

    'WorkflowRun',
    'WorkflowRunAwsem',
    'WorkflowRunSbg',

    'Page',
]


def main():
    parser = argparse.ArgumentParser(
        description="Create Elasticsearch mapping on deployment", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('config_uri', help="path to configfile")
    parser.add_argument('--app-name', help="Pyramid app name in configfile")
    parser.add_argument('--wipe-es', help="If specified on webprod will wipe ES", action='store_true', default=False)

    args = parser.parse_args()
    app = get_app(args.config_uri, args.app_name)
    # Loading app will have configured from config file. Reconfigure here:
    set_logging(in_prod=app.registry.settings.get('production'), log_name=__name__, level=logging.DEBUG)
    # set_logging(app.registry.settings.get('elasticsearch.server'), app.registry.settings.get('production'), level=logging.DEBUG)

    # check if staging
    try:
        data_env = whodaman()
        env = app.registry.settings.get('env.name')
        if 'webprod' in env:
            if data_env != env:
                log.info("Looks like we are deploying staging, checking --wipe-es")
                if args.wipe_es:
                    log.info('--wipe-es specified - obliging')
                    run_create_mapping(app, check_first=False, item_order=ITEM_INDEX_ORDER)
                else:
                    log.info('--wipe-es not specified - will not wipe ES')
                    run_create_mapping(app, check_first=True, item_order=ITEM_INDEX_ORDER)
                return
        # handle mastertest ... by blowing away all data first
        if 'mastertest' in env:
            log.info("looks like we are on mastertest, run create mapping without check first")
            run_create_mapping(app, check_first=False, purge_queue=True, item_order=ITEM_INDEX_ORDER)
            return
        log.info("looks like we are NOT on staging or mastertest so run create mapping with check first")
    except Exception:
        import traceback
        log.warning("error checking whodaman: %s " % traceback.format_exc())
        log.warning("couldn't get wodaman, so assuming NOT staging")
    log.info("... using default create mapping case")
    run_create_mapping(app, check_first=True, purge_queue=True, item_order=ITEM_INDEX_ORDER)
