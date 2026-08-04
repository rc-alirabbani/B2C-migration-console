'use strict';

module.exports = {
    getCurrent: function () {
        return {
            getID: function () {
                return 'MigrationConsole';
            },
            getCustomPreferenceValue: function () {
                return null;
            }
        };
    }
};
