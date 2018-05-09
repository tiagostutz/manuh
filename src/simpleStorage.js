module.exports = {
    storage: {},
    setItem: function(key, value) {
        this.storage[key] = JSON.stringify(value);
    },
    getItem: function(key) {
        return this.storage[key];
    }
}