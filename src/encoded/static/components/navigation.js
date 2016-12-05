'use strict';
var React = require('react');
var url = require('url');
var Login = require('./login');
var { Navbars, Navbar, Nav, NavItem, NavDropdown, MenuItem } = require('react-bootstrap');
var _ = require('underscore');
var TestWarning = require('./testwarning');
var productionHost = require('./globals').productionHost;


var Navigation = module.exports = React.createClass({

    statics : {

        /** May be bound to access this.props.href (if available) as fallback */
        getWindowUrl : function(mounted){
            var href;
            if (this && this.props && this.props.href) {
                href = url.parse(this.props.href);
            }
            if (mounted && typeof window === 'object' && window && typeof window.location !== 'undefined'){
                href = window.location;
            }
            if (!href) return null;
            return (href.pathname || '/') + (href.search || '') + (href.hash || '');
        },

        /** Can be bound to access this.props.href for getWindowUrl (if available) */
        buildMenuItem : function(action, mounted){
            return (
                <MenuItem
                    key={action.id}
                    id={action.sid || action.id}
                    href={action.url || action.href || '#'}
                    className="global-entry"
                    active={
                        (action.url && action.url === Navigation.getWindowUrl.call(this, mounted)) ||
                        (action.href && action.href === Navigation.getWindowUrl.call(this, mounted))
                    }
                >
                    {action.title}
                </MenuItem>
            );
        },

        /** Can be bound to access this.props.href for getWindowUrl (if available) */
        buildDropdownMenu : function(action, mounted){
            if (action.children){
                return (
                    <NavDropdown key={action.id} id={action.sid || action.id} label={action.id} title={action.title}>
                        {action.children.map((a) => Navigation.buildMenuItem(a, mounted) )}
                    </NavDropdown>
                );
            } else {
                return (
                    <NavItem key={action.id} id={action.sid || action.id} href={action.url || action.href || '#'} active={
                        (action.url && action.url === Navigation.getWindowUrl.call(this, mounted)) ||
                        (action.href && action.href === Navigation.getWindowUrl.call(this, mounted))
                    }>
                        {action.title}
                    </NavItem>
                );
            }
        }
    },

    contextTypes: {
        location_href: React.PropTypes.string,
        portal: React.PropTypes.object,
        listActionsFor : React.PropTypes.func
    },

    getInitialState: function() {
        return {
            testWarning: this.props.visible || !productionHost[url.parse(this.context.location_href).hostname] || false,
            mounted : false,
            dropdownOpen : false
        };
    },

    componentDidMount : function(){
        this.setState({ mounted : true });
    },

    closeMobileMenu : function(){
        if (this.state.dropdownOpen) this.setState({ dropdownOpen : false });
    },

    hideTestWarning: function(e) {
        // Remove the warning banner because the user clicked the close icon
        this.setState({testWarning: false});

        // If collection with .sticky-header on page, jiggle scroll position
        // to force the sticky header to jump to the top of the page.
        var hdrs = document.getElementsByClassName('sticky-header');
        if (hdrs.length) {
            window.scrollBy(0,-1);
            window.scrollBy(0,1);
        }
    },

    render: function() {
        var portal = this.context.portal;
        return (
            <div className={"navbar-container" + (this.state.testWarning ? " test-warning-visible" : "")}>
                <div id="navbar" className="navbar navbar-fixed-top navbar-inverse">
                    <TestWarning visible={this.state.testWarning} setHidden={this.hideTestWarning} />
                    <Navbar label="main" className="navbar-main" id="navbar-icon" onToggle={(open)=>{
                        this.setState({ dropdownOpen : open });
                    }} expanded={this.state.dropdownOpen}>
                        <Navbar.Header>
                            <Navbar.Brand>
                                <NavItem href="/" style={{ display : 'block' }}>
                                    <img src="/static/img/4dn_logo.svg" className="navbar-logo-image"/>
                                </NavItem>
                            </Navbar.Brand>
                            <Navbar.Toggle/>
                        </Navbar.Header>
                        <Navbar.Collapse>
                            <Nav>{ this.context.listActionsFor('global_sections').map((a)=> Navigation.buildDropdownMenu.call(this, a, this.state.mounted) ) }</Nav>
                            <UserActions mounted={this.state.mounted} />
                            {/* REMOVE SEARCH FOR NOW: <Search /> */}
                        </Navbar.Collapse>
                    </Navbar>
                </div>
            </div>
        );
    }
});


var Search = React.createClass({
    contextTypes: {
        location_href: React.PropTypes.string
    },

    render: function() {
        var id = url.parse(this.context.location_href, true);
        var searchTerm = id.query['searchTerm'] || '';
        return (
            <form className="navbar-form navbar-right" action="/search/">
                <input className="form-control search-query" id="navbar-search" type="text" placeholder="Search..."
                    ref="searchTerm" name="searchTerm" defaultValue={searchTerm} key={searchTerm} />
            </form>
        );
    }
});


var UserActions = React.createClass({
    contextTypes: {
        listActionsFor: React.PropTypes.func,
        session: React.PropTypes.bool
    },

    render: function() {
        var session = this.context.session;
        var acctTitle = (
            <span>
                <i title={session ? "Signed In" : null} className={"icon icon-user" + (session ? "" : "-o")}></i>&nbsp; Account
            </span>
        );

        var actions = [];
        this.context.listActionsFor('user_section').forEach((action) => {
            if (action.id === "login"){
                actions.push(<Login key={action.id} />);
            } else if (action.id === "accountactions"){
                // link to registration page if logged out or account actions if logged in
                if (!session) {
                    actions.push(Navigation.buildMenuItem.call(this, action, this.props.mounted));
                } else {
                    // Account Actions
                    actions = actions.concat(this.context.listActionsFor('user').map((action, idx) => {
                        return Navigation.buildMenuItem.call(this, action, this.props.mounted);
                    }));
                }
            } else if (action.id === "contextactions") {
                // Context Actions
                actions = actions.concat(this.context.listActionsFor('context').map((action) => {
                    return Navigation.buildMenuItem.call(
                        this,
                        _.extend(_.clone(action), { title : <span><i className="icon icon-pencil"></i> {action.title}</span> }),
                        this.props.mounted
                    );
                }));
            }
        });

        return (
            <Nav className="navbar-acct" pullRight>
                <NavDropdown id="context" label="context" title={acctTitle} >
                    { actions }
                </NavDropdown>
            </Nav>
        );
    }
});



// Display breadcrumbs with contents given in 'crumbs' object.
// Each crumb in the crumbs array: {
//     id: Title string to display in each breadcrumb. If falsy, does not get included, not even as an empty breadcrumb
//     query: query string property and value, or null to display unlinked id
//     uri: Alternative to 'query' property. Specify the complete URI instead of accreting query string variables
//     tip: Text to display as part of uri tooltip.
//     wholeTip: Alternative to 'tip' property. The complete tooltip to display
// }
var Breadcrumbs = module.exports.Breadcrumbs = React.createClass({
    propTypes: {
        root: React.PropTypes.string, // Root URI for searches
        crumbs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired // Object with breadcrumb contents
    },

    render: function() {
        var accretingQuery = '';
        var accretingTip = '';

        // Get an array of just the crumbs with something in their id
        var crumbs = _.filter(this.props.crumbs, function(crumb) { return crumb.id; });
        var rootTitle = crumbs[0].id;

        return (
            <ol className="breadcrumb">
                {crumbs.map((crumb, i) => {
                    // Build up the query string if not specified completely
                    if (!crumb.uri) {
                        accretingQuery += crumb.query ? '&' + crumb.query : '';
                    }

                    // Build up tooltip if not specified completely
                    if (!crumb.wholeTip) {
                        accretingTip += crumb.tip ? (accretingTip.length ? ' and ' : '') + crumb.tip : '';
                    }

                    // Render the breadcrumbs
                    return (
                        <li key={i}>
                            {(crumb.query || crumb.uri) ? <a href={crumb.uri ? crumb.uri : this.props.root + accretingQuery} title={crumb.wholeTip ? crumb.wholeTip : 'Search for ' + accretingTip + ' in ' + rootTitle}>{crumb.id}</a> : <span>{crumb.id}</span>}
                        </li>
                    );
                })}
            </ol>
        );
    }
});
