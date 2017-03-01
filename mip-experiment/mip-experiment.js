/**
 * @file mip-experiment extension
 * @author liangjiaying<jiaojiaomao220@163.com> 2017.02
 */

define(function (require) {

    var customElement = require('customElement').create();
    var util = require('util');
    var customStorage = new util.customStorage(0);

    /**
     * experiment variables initialization
     *
     * @param  {Object} ele mip-dom
     */
    function initExp(ele) {
        var jsonScript = ele.querySelector('script[type="application/json"][for="mip-experiment"]');
        var expString = jsonScript ? jsonScript.innerHTML : '';
        var needConsole = ele.hasAttribute('needConsole');
        var expJson = '';

        // mip-experiment variables valication
        try {
            expJson = JSON.parse(expString);
        } catch (err) {
            console.warn('<mip-experiment>配置不是合法JSON, ' + err.message);
            return;
        }
        if (!expJson) {
            return;
        }

        for (var expName in expJson) {
            var exp = new Experiment(expName, expJson, needConsole);
            // read experiment group
            var expGroup = exp.getExpGroup();
            exp.setExpGroup(expGroup);
        }
    }

    /**
     * read experiment group: use url group、history group, or set new group
     *
     * @param  {string} expName experiment name
     * @param  {Object} expJson json for experiment config
     * @param  {boolean} needConsole whether dump group info to console
     */
    var Experiment = function (expName, expJson, needConsole) {
        this.expName = expName;
        this.expVar = expJson[expName].variants || {};
        this.expVar.default = 100;
        this.needConsole = needConsole;
        this.isSticky = (function () {
            if (!('sticky' in expJson[expName])) {
                return true;
            }
            return !!expJson[expName].sticky;
        })();
    };

    /**
     * get experiment group
     *
     * @return {string} group name
     */
    Experiment.prototype.getExpGroup = function () {
        // if url hash is set, get group from URL
        var groupFromUrl = this._getExpGroupFromUrl();
        if (this.needConsole) {
            console.log('实验名: ' + this.expName);
            console.log('URL hash分组生效: ' + groupFromUrl);
        }

        // if history is set, get group from localstorage
        var groupFromStorage = '';
        if (this.isSticky && !groupFromUrl) {
            groupFromStorage = this._getExpGroupFromStorage();
            if (this.needConsole) {
                console.log('历史分组生效: ' + groupFromStorage);
            }
        }

        // make a new arrengment
        if (!groupFromStorage && !groupFromUrl) {
            var groupNew = this._getExpGroupNew();
            if (this.needConsole) {
                console.log('重新分组: ' + groupNew);
            }
        }

        var finalGroup = groupFromUrl || groupFromStorage || groupNew;
        if (this.needConsole) {
            console.log('最终分组: ' + finalGroup + '\n\n');
        }
        return finalGroup;
    };

    /**
     * get forced group from URL
     * hash：#mip-x-btn-color=red&mip-x-font-color=white
     *
     * @return {string} experiment group name
     */
    Experiment.prototype._getExpGroupFromUrl = function () {
        var hash = window.location.hash.slice(1);
        var group = '';
        if (!hash) {
            return '';
        }

        var expGroupArr = hash.split('&');
        for (var i in expGroupArr) {
            if (!expGroupArr[i].match(this.expName + '=')) {
                continue;
            }
            var regExp = new RegExp('mip-x-' + this.expName + '=(\\w+)');
            var expGroup = regExp.exec(expGroupArr[i])[1];
            group = expGroup in this.expVar ? expGroup : '';
        }
        return group;
    };

    /**
     * get group form localstorage
     *
     * @return {string} experiment group name
     */
    Experiment.prototype._getExpGroupFromStorage = function () {
        var group = customStorage.get('mip-x-' + this.expName);
        return group in this.expVar ? group : '';
    };

    /**
     * reset group
     *
     * @return {string} experiment group name
     */
    Experiment.prototype._getExpGroupNew = function () {
        var rNumber = Math.random() * 100;
        var groups = Object.keys(this.expVar);
        // 根据随机数和每组份数计算新分组
        for (var i = 0; i < groups.length - 1; i++) {
            var percentCur = this._addVars(i, this.expVar);
            // XXX: i为字符串，i-0变为数字
            var percentNext = this._addVars(i + 1, this.expVar);
            if (i === 0 && rNumber < this.expVar[groups[0]]) {
                return groups[0];
            }
            if (rNumber >= percentCur && rNumber < percentNext) {
                return groups[i + 1];
            } else if (rNumber > percentNext) {
                continue;
            }
        }
        return 'default';
    };

    /**
     * Add config ratio recursively
     *
     * @param {number} i      i
     * @param {Object} expVar variables in config
     * @return {number} addition of config
     */
    Experiment.prototype._addVars = function (i, expVar) {
        var groups = Object.keys(expVar);
        if (i === 0) {
            return expVar[groups[0]];
        }
        return expVar[groups[i]] + arguments.callee(i - 1, expVar);
    };

    /**
     * assign experiment to <body>
     *
     * @param {string} expGroup experiment group
     */
    Experiment.prototype.setExpGroup = function (expGroup) {
        customStorage.set('mip-x-' + this.expName, expGroup);
        if (expGroup !== 'default') {
            // XXX: no use of document.body for there might be multiple bodies
            document.querySelector('body').setAttribute('mip-x-' + this.expName, expGroup);
        }
    };

    /**
     * build element, exec only once
     */
    customElement.prototype.build = function () {
        var element = this.element;
        element.needConsole = element.hasAttribute('needConsole');
        initExp(element);
        util.css(element, 'display', 'inherit');
    };

    return customElement;
});
