'use strict';

// Require all components to ensure javascript load ordering

/**
 * Here we import all of our Content Views (Page Views) and register them
 * to `globals.content_views` so that they may be picked up and routed to in
 * the root `App` component.
 */

import { content_views }        from './globals';

import StaticPage               from './static-pages/StaticPage';
import DirectoryPage            from './static-pages/DirectoryPage';

import HomePage                 from './static-pages/HomePage';
import PlannedSubmissionsPage   from './static-pages/PlannedSubmissionsPage';
import ReleaseUpdates           from './static-pages/ReleaseUpdates';
import StatisticsPageView       from './static-pages/StatisticsPageView';


import DefaultItemView          from './item-pages/DefaultItemView';
import CaseView                 from './item-pages/CaseView';
import IndividualView           from './item-pages/IndividualView';
import HealthView               from './item-pages/HealthView';
import UserView, { ImpersonateUserForm } from './item-pages/UserView';
import SchemaView               from './item-pages/SchemaView';
import FallbackView             from './item-pages/FallbackView';
import DocumentView             from './item-pages/DocumentView';
import StaticSectionView        from './item-pages/StaticSectionView';
import CGAPSubmissionView       from './forms/CGAPSubmissionView';
//import SubmissionView           from '@hms-dbmi-bgm/shared-portal-components/src/components/forms/SubmissionView';
import SearchView               from './browse/SearchView';

content_views.register(StaticPage,    'StaticPage');
content_views.register(DirectoryPage, 'DirectoryPage');

content_views.register(HomePage,                'HomePage');
content_views.register(PlannedSubmissionsPage,  'Planned-submissionsPage');
content_views.register(ReleaseUpdates,          'Release-updatesPage');
content_views.register(StatisticsPageView,      'StatisticsPage');


content_views.register(DefaultItemView,         'Item');
content_views.register(CaseView,                'Case');
content_views.register(IndividualView,          'Individual');
content_views.register(HealthView,              'Health');
content_views.register(DocumentView,            'Document');
content_views.register(SchemaView,              'JSONSchema');
content_views.register(UserView,                'User');
content_views.register(ImpersonateUserForm,     'User', 'impersonate-user');
content_views.register(StaticSectionView,       'StaticSection');

content_views.register(CGAPSubmissionView,      'Item', 'edit');
content_views.register(CGAPSubmissionView,      'Item', 'create');
content_views.register(CGAPSubmissionView,      'Item', 'clone');
content_views.register(CGAPSubmissionView,      'Search', 'add');

content_views.register(SearchView,              'Search');
content_views.register(SearchView,              'Search', 'selection');


// Fallback for anything we haven't registered
content_views.fallback = function () {
    return FallbackView;
};

import App from './app';

export default App;
