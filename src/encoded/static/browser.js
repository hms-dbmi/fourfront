'use strict';
// Entry point for browser, compiled into bundle[.chunkHash].js.

import React from 'react';
import ReactDOM from 'react-dom';

import App from './components';
var domready = require('domready');
import { store, mapStateToProps } from './store';
import { Provider, connect } from 'react-redux';
import { patchedConsoleInstance as console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';
import { logger }  from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import * as JWT from '@hms-dbmi-bgm/shared-portal-components/es/components/util/json-web-token';
import { BrowserFeat } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/layout';

/**
 * Unset JWT/auth and reload page if missing user info which should be paired with otherwise valid JWT token.
 * If user_info valid (exists), update localStorage w/ server-provider user_details (through props).
 * If no user_details provided, assume not logged in and unset JWT, then continue.
 * User info would have been obtained on login & contains user_actions (only obtained through /login).
 */
function updateSessionInfo(){

    let props;

    // Try-block just in case,
    // keep <script data-prop-type="user_details"> in <head>, before <script data-prop-type="inline">, in app.js
    // so is available before this JS (via bundle.js)
    try {
        props = App.getRenderedPropValues(document, 'user_info');
    } catch(e) {
        logger.error(e);
        return false;
    }

    const { user_info } = props;
    const { details: { email } = {} } = user_info || {};

    if (email && typeof email === 'string'){
        // We have user_info from server-side; keep client-side in sync (in case updated via/by back-end / dif client at some point)
        JWT.saveUserInfoLocalStorage(user_info);
    } else {
        // Ensure no lingering userInfo or token in localStorage or cookies
        JWT.remove();
    }
}

// Treat domready function as the entry point to the application.
// Inside this function, kick-off all initialization, everything up to this
// point should be definitions.
if (typeof window !== 'undefined' && window.document && !window.TEST_RUNNER) {

    updateSessionInfo();

    domready(function(){
        console.log('Browser: ready');

        // Update Redux store from Redux store props that've been rendered server-side
        // into <script data-prop-name={ propName }> elements.
        var initialReduxStoreState = App.getRenderedProps(document);
        delete initialReduxStoreState.user_details; // Stored into localStorage.
        store.dispatch({ 'type' : initialReduxStoreState });

        const AppWithReduxProps = connect(mapStateToProps)(App);
        let app;

        try {
            app = ReactDOM.hydrate(<Provider store={store}><AppWithReduxProps /></Provider>, document);
        } catch (e) {
            logger.error("INVARIANT ERROR",e); // To debug
            // So we can get printout and compare diff of renders.
            app = require('react-dom/server').renderToString(<Provider store={store}><AppWithReduxProps /></Provider>);
        }

        // Set <html> class depending on browser features
        BrowserFeat.setHtmlFeatClass();

        // Simplify debugging
        window.app = app;
        window.React = React;
    });

}
