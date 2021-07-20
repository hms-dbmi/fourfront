import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import { console, isServerSide, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


let hasScriptBeenLoaded = false;

/**
 * THIS WAS COPIED OVER FROM `react-twitter-embed` and extended.
 * At some point in future might want to finalize "Fade In" additions and PR it to main repo.
 *
 * @see https://github.com/saurabhnemade/react-twitter-embed/blob/master/src/components/TwitterTimelineEmbed.js
 */
export default class TwitterTimelineEmbed extends React.PureComponent {

    static defaultProps = {
        twitterJSURL: "https://platform.twitter.com/widgets.js"
    };

    constructor(props) {
        super(props);
        this.state = {
            isLoading: true
        };

        this.embedContainerRef = React.createRef();
    }

    buildChromeOptions(options) {
        const { noHeader = false, noFooter = false, noBorders = false, noScrollbar = false, transparent = false } = this.props;

        options.chrome = '';

        if (noHeader) options.chrome += ' noheader';
        if (noFooter) options.chrome += ' nofooter';
        if (noBorders) options.chrome += ' noborders';
        if (noScrollbar) options.chrome += ' noscrollbar';
        if (transparent) options.chrome += ' transparent';

        return options;
    }

    buildOptions() {
        const { options: propOptions, autoHeight = false, theme, linkColor, borderColor, lang } = this.props;
        let options = Object.assign({}, propOptions, { theme, linkColor, borderColor, lang })
        if (autoHeight) {
            options.height = this.embedContainerRef.current.parentNode.offsetHeight
        }
        return options
    }

    /** Experimental and probably against Twitter's Developer Policy / Terms. Not used b.c. of this. */
    cleanupTwitterScripts() {
        // Spread to array for faster lookups, else is HTMLLiveCollection and gets from
        // DOM on each reference call/check/traversal.
        const iframesOnPage = [...window.document.getElementsByTagName("iframe")];
        const iframesToCleanup = iframesOnPage.filter(function (iframeElem) {
            const parentElemName = (iframeElem.parentElement && (iframeElem.parentElement.localName || iframeElem.parentElement.nodeName).toLowerCase()) || null;
            // In future we could gather maybe more accurately with https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            if (parentElemName !== "body") {
                // Might be widget iframe itself. Which would get removed when this component dismounts, so we can skip.
                return false;
            }
            if (iframeElem.title) {
                if (iframeElem.title.indexOf("Twitter") > -1) {
                    return true;
                }
            }
            if (iframeElem.src) {
                const iframeSrcParts = url.parse(iframeElem.src);
                if (iframeSrcParts.hostname.indexOf("twitter.com") > -1) {
                    return true;
                }
            }
            return false;
        });
        while (iframesToCleanup.length > 0) {
            const iframeElem = iframesToCleanup.pop();
            window.document.body.removeChild(iframeElem);
        }
    }

    renderWidget(options) {
        const { onLoad, sourceType, screenName, userId, ownerScreenName, slug, id, widgetId, url } = this.props;

        if (this.isMountCanceled) return;

        window.twttr.widgets.createTimeline(
            {
                sourceType,
                screenName,
                userId,
                ownerScreenName,
                slug,
                id: id || widgetId,
                url
            },
            this.embedContainerRef.current,
            options
        ).then((element) => {

            if (!element) {
                // Happens occasionally, maybe due to network or adblocker.
                logger.error("TwitterTimelineEmbed - Couldn't load/get element");
                return false;
            }

            // `element` here is the iframe that TwitterJS created.
            this.setState({
                isLoading: false
            }, () => {
                this.embedContainerRef.current.style.opacity = 1;
                // Cleanup analytics iframes from Twitter
                //this.cleanupTwitterScripts();
            });
            if (onLoad) {
                onLoad(element);
            }
            // Prevent contents of iframe from being navigateble-to via [shift + ] tab key.
            element.setAttribute("tabindex", -1);
        });
    }

    componentDidMount() {
        const { twitterJSURL } = this.props;

        const initWidget = () => {
            if (this.isMountCanceled) {
                return;
            }
            if (!window.twttr) {
                console.error('Failure to load window.twttr in TwitterTimelineEmbed, aborting load.')
                return;
            }
            const options = this.buildOptions();
            this.buildChromeOptions(options);
            this.renderWidget(options);
        };

        const onLoadedTwitterJSLib = ()=> {
            hasScriptBeenLoaded = true;
            initWidget();
        };

        setTimeout(()=>{
            if (hasScriptBeenLoaded) {
                initWidget();
                return;
            }
            const head = window.document.head;
            if (!head) {
                return;
            }
            const scriptElem = window.document.createElement("script");
            scriptElem.src = twitterJSURL;
            scriptElem.defer = scriptElem.async = true;
            scriptElem.id = "twitter-js";
            scriptElem.type = "text/javascript";
            scriptElem.onload = onLoadedTwitterJSLib;
            head.appendChild(scriptElem);
            hasScriptBeenLoaded = true;
        }, 50);
    }
    
    componentWillUnmount() {
        this.isMountCanceled = true
    }
    
    render() {
        const { isLoading } = this.state
        const { placeholder, className } = this.props
        return (
            <React.Fragment>
                { isLoading && placeholder }
                <div ref={this.embedContainerRef} className={className} style={{ opacity: 0, transition: "opacity .3s ease-out" }} />
            </React.Fragment>
        );
    }
}
