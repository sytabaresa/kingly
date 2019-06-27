const presets = [
    [
        "@babel/env",
        {
            targets: {
                edge: "11",
                firefox: "40",
                chrome: "57",
                safari: "11.1",
            },
        },
    ],
];

module.exports = { presets };
