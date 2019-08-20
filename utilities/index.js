module.exports = {
    simpleName: (s) => {
        return s.replace(/\.?([A-Z])/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "");
    }
}