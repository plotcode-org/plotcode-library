# CONTRIBUTING

Thanks for your interest in contributing to the Plotcode library!

If you need any help, please reach out on [Discord](https://discord.plotcode.com).

# Folder structure

The repo is organised in the following structure:

```
patterns
└── <cloud>-<pattern>
    └── pattern.json
    ├── <framework>-<language>
    │   └── reference.json
    └── <framework>-<language>
        └── reference.json
```

# Update pattern.json or reference.json

Submit a pull request to update the `pattern.json` or `reference.json` file.

# Convert existing AWS CDK pattern to Pulumi

Copy the Pulumi language folder from the [template folder](https://github.com/plotcode-org/plotcode-library/tree/main/templates) and place inside the AWS pattern directory.

Your new directory should look like this:

```
aws-example
└── pattern.json
├── cdk-typescript
│   └── reference.json
└── pulumi-typescript <<< NEW
    └── reference.json <<< NEW
    └── ... Pulumi files <<< NEW
```

Once you have converted the pattern, make sure to update the reference.json and then submit a pull request.
