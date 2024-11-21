/*
Calibres stylesheet
*/

export default `
@charset "UTF-8";

/*
  Calibre styles
*/
.arabic {
    display: block;
    list-style-type: decimal;
    margin-bottom: 1em;
    margin-right: 0;
    margin-top: 1em;
    text-align: justify
    }
.attribution {
    display: block;
    font-size: 1em;
    line-height: 1.2;
    text-align: left;
    margin: 0.3em 0
    }
.big {
    font-size: 1.375em;
    line-height: 1.2
    }
.big1 {
    font-size: 1em
    }
.block {
    display: block;
    text-align: justify;
    margin: 1em 1em 2em
    }
.block1 {
    display: block;
    text-align: justify;
    margin: 1em 4em
    }
.block2 {
    display: block;
    text-align: justify;
    margin: 1em 1em 1em 2em
    }
.bullet {
    display: block;
    list-style-type: disc;
    margin-bottom: 1em;
    margin-right: 0;
    margin-top: 1em;
    text-align: disc
    }
.calibre {
    background-color: #000007;
    display: block;
    font-family: Charis, "Times New Roman", Verdana, Arial;
    font-size: 1.125em;
    line-height: 1.2;
    padding-left: 0;
    padding-right: 0;
    text-align: center;
    margin: 0 5pt
    }
.calibre1 {
    display: block
    }
.calibre2 {
    height: auto;
    width: auto
    }
.calibre3:not(strong) {
    display: block;
    font-family: Charis, "Times New Roman", Verdana, Arial;
    font-size: 1.125em;
    line-height: 1.2;
    padding-left: 0;
    padding-right: 0;
    margin: 0 5pt
    }
.calibre4 {
    font-weight: bold
    }
.calibre5 {
    font-style: italic
    }
.calibre6 {
    background-color: #FFF;
    display: block;
    font-family: Charis, "Times New Roman", Verdana, Arial;
    font-size: 1.125em;
    line-height: 1.2;
    padding-left: 0;
    padding-right: 0;
    text-align: center;
    margin: 0 5pt
    }
.calibre7 {
    display: list-item
    }
.calibre8 {
    font-size: 1em;
    line-height: 1.2;
    vertical-align: super
    }
.calibre9 {
    border-collapse: separate;
    border-spacing: 2px;
    display: table;
    margin-bottom: 0;
    margin-top: 0;
    text-indent: 0
    }
.calibre10 {
    display: table-row;
    vertical-align: middle
    }
.calibre11 {
    display: table-cell;
    text-align: right;
    vertical-align: inherit;
    padding: 1px
    }
.calibre12 {
    display: table-cell;
    text-align: left;
    vertical-align: inherit;
    padding: 1px
    }
.calibre13 {
    height: 1em;
    width: auto
    }
.calibre14 {
    font-size: 0.88889em;
    line-height: 1.2;
    vertical-align: super
    }
.calibre15 {
    font-size: 1em;
    line-height: 1.2;
    vertical-align: sub
    }
.calibre16 {
    display: block;
    list-style-type: decimal;
    margin-bottom: 1em;
    margin-right: 0;
    margin-top: 1em
    }
.calibre17 {
    display: block;
    font-size: 1.125em;
    font-weight: bold;
    line-height: 1.2;
    margin: 0.83em 0
    }
.center {
    display: block;
    text-align: center;
    margin: 1em 0
    }
.center1 {
    display: block;
    font-size: 1em;
    font-weight: bold;
    line-height: 1.2;
    text-align: center;
    margin: -2em 0 3em
    }
.center2 {
    display: block;
    font-size: 1em;
    font-weight: bold;
    line-height: 1.2;
    text-align: center;
    margin: 2em 0 1em
    }
.center3 {
    display: block;
    text-align: center;
    margin: -1em 0 1em
    }
.center4 {
    display: block;
    text-align: center;
    text-indent: 3%;
    margin: 1em 0
    }
.chapter {
    display: block;
    font-size: 1.125em;
    font-weight: bold;
    line-height: 2em;
    text-align: center;
    margin: 2em 0 1em
    }
.chapter1 {
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    margin-left: 0.5em;
    margin-right: 0.5em;
    margin-top: 2em
    }
.chapter2 {
    display: block;
    font-size: 1.125em;
    font-weight: bold;
    line-height: 2em;
    text-align: center;
    margin: 2em 0 3em
    }
.copyright {
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    margin-top: 4em;
    text-align: center
    }
.dedication {
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    margin-top: 4em
    }
.dropcaps {
    float: left;
    font-size: 3.4375rem;
    line-height: 50px;
    margin-right: 0.09em;
    margin-top: -0.05em;
    padding-top: 1px
    }
.dropcaps1 {
    float: left;
    font-size: 3.4375rem;
    line-height: 50px;
    margin-right: 0.09em;
    margin-top: 0.15em;
    padding-top: 1px
    }
.extract {
    display: block;
    text-align: justify;
    margin: 2em 0 0.3em
    }
.extract1 {
    display: block;
    text-align: justify;
    text-indent: 3%;
    margin: 2em 0 0.3em
    }
.extract2 {
    display: block;
    text-align: justify;
    margin: 1em 0 0.3em
    }
.footnote {
    border-bottom-style: solid;
    border-bottom-width: 0;
    border-left-style: solid;
    border-left-width: 0;
    border-right-style: solid;
    border-right-width: 0;
    border-top-style: solid;
    border-top-width: 1px;
    display: block;
    font-size: 1em;
    line-height: 1.2;
    margin-top: 2 em
    }
.footnote1 {
    display: block;
    text-align: justify;
    margin: 0.3em 0 0.3em 2
    }
.footnote2 {
    border-bottom-style: solid;
    border-bottom-width: 0;
    border-left-style: solid;
    border-left-width: 0;
    border-right-style: solid;
    border-right-width: 0;
    border-top-style: solid;
    border-top-width: 1px;
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    margin-top: 2 em
    }
.hanging {
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    text-align: left;
    text-indent: -1em;
    margin: 0.5em 0 0.3em 1em
    }
.hanging1 {
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    text-align: left;
    text-indent: -1em;
    margin: 0.5em 0 0.3em 1.5em
    }
.hanging2 {
    display: block;
    font-size: 1em;
    line-height: 1.2;
    text-indent: -1em;
    margin: 0.5em 0 0.3em 1em
    }
.hanging3 {
    display: block;
    font-size: 1em;
    line-height: 1.2;
    text-align: left;
    text-indent: 1em;
    margin: 0.1em 0 0.3em 1em
    }
.hanging4 {
    display: block;
    font-size: 1em;
    line-height: 1.2;
    text-align: left;
    text-indent: 0.1em;
    margin: 0.1em 0 0.3em 1em
    }
a.hlink {
    text-decoration: none
    }
.indent {
    display: block;
    text-align: justify;
    text-indent: 1em;
    margin: 0.3em 0
    }
.line {
    border-top: currentColor solid 1px;
    border-bottom: currentColor solid 1px
    }
.loweralpha {
    display: block;
    list-style-type: lower-alpha;
    margin-bottom: 1em;
    margin-right: 0;
    margin-top: 1em;
    text-align: justify
    }
.none {
    display: block;
    list-style-type: none;
    margin-bottom: 1em;
    margin-right: 0;
    margin-top: 1em;
    text-align: justify
    }
.none1 {
    display: block;
    list-style-type: none;
    margin-bottom: 0;
    margin-right: 0;
    margin-top: 0;
    text-align: justify
    }
.nonindent {
    display: block;
    text-align: justify;
    margin: 0.3em 0
    }
.nonindent1 {
    display: block;
    font-size: 1.125em;
    line-height: 1.2;
    text-indent: -1em;
    margin: 0.5em 0 0.3em 0.1em
    }
.nonindent2 {
    display: block;
    font-size: 1.125em;
    line-height: 1.2;
    text-indent: -1em;
    margin: 0.5em 0 0.3em -0.5em
    }
.nonindent3 {
    display: block;
    text-align: justify;
    text-indent: 3%;
    margin: 0.3em 0
    }
.part {
    display: block;
    font-size: 1em;
    font-weight: bold;
    line-height: 2em;
    text-align: center;
    margin: 4em 0 1em
    }
.preface {
    display: block;
    font-size: 0.88889em;
    line-height: 1.2;
    margin-left: 2em;
    margin-right: 2em;
    text-align: justify
    }
.pubhlink {
    color: green;
    text-decoration: none
    }
.right {
    display: block;
    text-align: right;
    margin: 0.3em 0
    }
.section {
    display: block;
    font-size: 1.125em;
    font-weight: bold;
    line-height: 1.2;
    text-align: center;
    margin: 2em 0 0.5em
    }
.section1 {
    display: block;
    font-size: 1.125em;
    font-weight: bold;
    line-height: 1.2;
    text-align: left;
    margin: 2em 0 0.3em
    }
.section2 {
    display: block;
    font-size: 1em;
    font-weight: bold;
    line-height: 1.2;
    text-align: left;
    margin: 2em 0 0.3em 1em
    }
.small {
    font-size: 0.66667em
    }
.small1 {
    font-size: 0.75em
    }
.subchapter {
    display: block;
    font-size: 1.125em;
    font-weight: bold;
    line-height: 1.2;
    margin: 1em 0
    }
.textbox {
    background-color: #E4E4E4;
    display: block;
    line-height: 1.5em;
    margin-bottom: 2em;
    margin-top: 2em;
    text-align: justify;
    border-top: currentColor double 2px;
    border-bottom: currentColor double 2px
    }
.textbox1 {
    display: block;
    text-align: justify;
    margin: 0.3em 0.5em 0.3em 0.8em
    }
.textbox2 {
    display: block;
    text-align: justify;
    text-indent: 1em;
    margin: 0.3em 0.5em
    }
.textbox3 {
    display: block;
    text-align: justify;
    text-indent: 3%;
    margin: 0.3em 0.5em 0.3em 0.8em
    }
.titlepage {
    display: block;
    margin-left: -0.4em;
    margin-top: 1.2em
    }
.toc {
    display: block;
    font-size: 1em;
    line-height: 1.2;
    text-align: center
    }
.toc1 {
    display: block;
    font-size: 1em;
    font-weight: bold;
    line-height: 1.2;
    text-align: center;
    margin: 0.67em 0 3em
    }
.underline {
    text-decoration: underline
    }
`