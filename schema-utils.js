exports = module.exports = {
    permalink: function(type) {
        var parts = type.split("/");
        var name = parts[1];

        return {
            type: "object",
            properties: {
                href: {
                    type: "string",
                    format: "uri",
                    pattern: "^\/" + name + "\/.*$",
                    minLength: 45,
                    maxLength: 45
                },
                required: ["href"]
            }
        };
    },

    string: function(min, max) {
        return {
            type: "string",
            minLength: min,
            maxLength: max
        }
    },

    numeric: {
        type: "numeric",
        multipleOf: "1.0"
    },

    email: {
        type: "string",
        format: "email",
        minLength: 1,
        maxLength: 32
    },

    url: {
        type: "string",
        minLength: 1,
        maxLength: 256,
        format: "uri"
    },

    zipcode: {
        type: "number",
        multipleOf: 1.0,
        minimum: 1000,
        maximum: 9999
    },

    phone: {
        type: "string",
        pattern: "^[0-9]*$",
        minLength: 9,
        maxLength: 10
    },

    timestamp : {
        type: "string",
        format: "date-time"
    }
};
