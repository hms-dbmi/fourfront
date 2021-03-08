'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import _ from 'underscore';
import Navbar from 'react-bootstrap/esm/Navbar';
import { console, isSelectAction, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { FourfrontLogo } from './../viz/FourfrontLogo';
import { portalConfig } from './../globals';
import { SearchBar, TestWarning, LeftNav, AccountNav, BigDropdownGroupController } from './components';
import QuickInfoBar from './../viz/QuickInfoBar';
import { ChartDataController } from './../viz/chart-data-controller';



/**
 * Some of this code is deprecated and can be re-factored.
 * E.g. We use BigDropdown now for static pages menu.
 * At some point, the login/user menu should be updated as well.
 *
 * @todo Refactor and delete old unused code.
 * @todo Change login/user menu to match BigDropdown for Help pages.
 * @todo In new user/login menu (BigDropdown style), include more stuff from profile, e.g. Gravatar photo.
 */
export class NavigationBar extends React.PureComponent {

    static propTypes = {
        'href': PropTypes.string,
        'session': PropTypes.bool,
        'updateAppSessionState': PropTypes.func.isRequired,
        'context': PropTypes.object,
        'schemas': PropTypes.any,
        'browseBaseState': PropTypes.string,
        'isFullscreen' : PropTypes.bool
    };

    constructor(props){
        super(props);
        this.hideTestWarning = this.hideTestWarning.bind(this);
        this.closeMobileMenu = this.closeMobileMenu.bind(this);
        this.onToggleNavBar = this.onToggleNavBar.bind(this);

        let testWarning = true;
        const initHostName = memoizedUrlParse(props.href).hostname;
        if (initHostName && portalConfig.productionHosts.indexOf(initHostName) > -1) {
            testWarning = false;
        }

        /**
         * Navbar state.
         *
         * @private
         * @constant
         * @property {boolean} state.testWarning        Whether Test Data warning banner is visible. Initially determined according to if are on production hostname.
         * @property {boolean} state.mounted            Whether are mounted.
         * @property {boolean} state.mobileDropdownOpen Helper state to keep track of if menu open on mobile because mobile menu doesn't auto-close after navigation.
         */
        this.state = {
            testWarning,
            'mounted'               : false,
            'mobileDropdownOpen'    : false
        };
    }

    /**
     * Initializes scroll event handler & loading of help menu tree.
     *
     * @private
     * @returns {void}
     */
    componentDidMount(){
        this.setState({ 'mounted' : true });
    }

    /**
     * Re-loads help menu tree if session (user login state) has changed.
     *
     * @private
     * @returns {void}
     */
    componentDidUpdate(prevProps, prevState){
        const { href, session } = this.props;
        if ((typeof session === 'boolean' && session !== prevProps.session) || href !== prevProps.href){
            this.closeMobileMenu();
        }
    }

    closeMobileMenu(){
        this.setState( ({ mobileDropdownOpen }) => {
            if (!mobileDropdownOpen) return null;
            return { 'mobileDropdownOpen' : false };
        });
    }

    /**
     * Sets `state.testWarning` to be false and scrolls the window if sticky header is visible (BrowseView, SearchView)
     * so that sticky header gets its dimension(s) updated.
     *
     * @param {React.SyntheticEvent} [e] An event, if any. Unused.
     * @returns {void}
     */
    hideTestWarning(e) {
        // Remove the warning banner because the user clicked the close icon
        this.setState({ 'testWarning': false });

        // If collection with .sticky-header on page, jiggle scroll position
        // to force the sticky header to jump to the top of the page.
        var hdrs = document.getElementsByClassName('sticky-header');
        if (hdrs.length) {
            window.scrollBy(0,-1);
            window.scrollBy(0,1);
        }
    }

    onToggleNavBar(open){
        this.setState({ 'mobileDropdownOpen' : open });
    }

    render() {
        const { testWarning, mobileDropdownOpen, mounted } = this.state;
        const { href, context, schemas, browseBaseState, isFullscreen, currentAction } = this.props;
        const testWarningVisible = !!(testWarning & !isFullscreen & !isSelectAction(currentAction) ); // Hidden on full screen mode.
        const navClassName = (
            "navbar-container" +
            (testWarningVisible ? ' test-warning-visible' : '')
        );

        return (
            <div className={navClassName}>
                <div id="top-nav" className="navbar-fixed-top" role="navigation">
                    <TestWarning visible={testWarningVisible} setHidden={this.hideTestWarning} href={href} />
                    <div className="navbar-inner-container">
                        <Navbar label="main" expand="md" className="navbar-main" id="navbar-icon"
                            onToggle={this.onToggleNavBar} expanded={mobileDropdownOpen}>

                            <a className="navbar-brand" href="/">
                                <FourfrontLogo />
                            </a>

                            <Navbar.Toggle>
                                <i className="icon icon-bars fas icon-fw align-middle" />
                            </Navbar.Toggle>

                            <CollapsedNav {...this.props} {...{ testWarningVisible, mounted }} />
                        </Navbar>
                    </div>
                    <QuickInfoBar {...{ href, schemas, context, browseBaseState }} />
                </div>
            </div>
        );
    }
}

const CollapsedNav = React.memo(function CollapsedNav(props) {
    const {
        href, currentAction, session, mounted,
        overlaysContainer, windowWidth, windowHeight,
        browseBaseState, testWarningVisible,
        addToBodyClassList, removeFromBodyClassList,
        schemas, updateAppSessionState
    } = props;

    const leftNavProps = {
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        testWarningVisible, browseBaseState//, addToBodyClassList, removeFromBodyClassList
    };

    const userActionNavProps = {
        windowWidth, windowHeight, href, mounted, overlaysContainer, session,
        schemas, updateAppSessionState, testWarningVisible
    };

    return (
        <Navbar.Collapse>
            <BigDropdownGroupController {...{ addToBodyClassList, removeFromBodyClassList }}>
                <LeftNav {...leftNavProps} />
                <SearchBar {...{ href, currentAction, browseBaseState }} />
                <AccountNav {...userActionNavProps} />
            </BigDropdownGroupController>
        </Navbar.Collapse>
    );
});
