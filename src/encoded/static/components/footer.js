'use strict';
var React = require('react');

var Footer = React.createClass({
    contextTypes: {
        session: React.PropTypes.bool
    },

    propTypes: {
        version: React.PropTypes.string // App version number
    },

    render: function() {
        return (
            <footer id="page-footer">
                <div className="page-footer">
                    <div className="container">
                        <div className="row">
                            <div className="col-sm-6 col-sm-pull-6 col-md-pull-0">
                                <div className="copy-notice footer-links">
                                    <a href="http://dcic.4dnucleome.org" target="_blank" style={{ fontWeight : '400' }}>
                                        4D Nucleome Data Coordination and Integration Center
                                    </a>
                                </div>
                            </div>
                            <div className="col-sm-6 col-sm-push-6 col-md-push-0">
                                <ul className="footer-links">
                                    <li><a href="http://www.harvard.edu/" target="_blank">Harvard University</a></li>
                                    <span>|</span>
                                    <li><a href="http://www.mit.edu/" target="_blank">Massachusetts Institute of Technology</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        );
    }
});

module.exports = Footer;
