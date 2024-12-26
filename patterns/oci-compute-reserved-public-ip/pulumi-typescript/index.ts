import * as oci from "@pulumi/oci";

// From an architectural viewpoint, a compartment is simply a logical group of OCI resources.
const exampleCompartment = new oci.identity.Compartment("exampleCompartment", {
    name: "exampleCompartment",
    description: "Compartment for example resources",
    enableDelete: true
});

// Create a new Virtual Cloud Network (VCN)
const vcnResource = new oci.core.Vcn("vcnResource", {
    compartmentId: exampleCompartment.id,
    cidrBlock: "10.0.0.0/16",
    displayName: "vcn",
    dnsLabel: "vcn",
})

// Create a new internet gateway
const internetGatewayResource = new oci.core.InternetGateway("internetGatewayResource", {
    compartmentId: exampleCompartment.id,
    vcnId: vcnResource.id,
    enabled: true,
    displayName: "internetGateway",
})

// Attach route table to internet gateway
const routeTableResource = new oci.core.RouteTable("routeTableResource", {
    compartmentId: exampleCompartment.id,
    vcnId: vcnResource.id,
    displayName: "routeTable",
    routeRules: [{
        networkEntityId: internetGatewayResource.id,
        destination: "0.0.0.0/0",
        destinationType: "CIDR_BLOCK"
    }]
})

// Security list
const securityListResource = new oci.core.SecurityList("securityListResource", {
    compartmentId: exampleCompartment.id,
    vcnId: vcnResource.id,
    displayName: "securityList",
    egressSecurityRules: [{
        destination: "0.0.0.0/0",
        protocol: "all",
        destinationType: "CIDR_BLOCK",
        stateless: false,
    }],
    ingressSecurityRules: [
        {
            protocol: "6",
            source: "0.0.0.0/0",
            description: "SSH",
            tcpOptions: {
                max: 22,
                min: 22
            },
            sourceType: "CIDR_BLOCK",
            stateless: false
        },
        {
            protocol: "6",
            source: "0.0.0.0/0",
            description: "HTTP Web",
            tcpOptions: {
                max: 80,
                min: 80
            },
            sourceType: "CIDR_BLOCK",
            stateless: false
        }
    ],
})

// Create a public subnet
const publicSubnetResource = new oci.core.Subnet("publicSubnetResource", {
    compartmentId: exampleCompartment.id,
    vcnId: vcnResource.id,
    cidrBlock: "10.0.0.0/24",
    displayName: "publicSubnet",
    dnsLabel: "publicsubnet",
    prohibitInternetIngress: false,
    prohibitPublicIpOnVnic: false,
    routeTableId: routeTableResource.id,
    securityListIds: [securityListResource.id],
})

const testAvailabilityDomains = exampleCompartment.id.apply((id: string) =>
    oci.identity.getAvailabilityDomains({
        compartmentId: id,
    })
);


const instanceResource = new oci.core.Instance("instanceResource", {
    compartmentId: exampleCompartment.id,
    availabilityDomain: testAvailabilityDomains.availabilityDomains[0].name,
    shape: "VM.Standard.A1.Flex",
    createVnicDetails: {
        assignPrivateDnsRecord: true,
        // We don't assign an ephemeral public IP address when creating the instance.
        // This then allows us to attach a reserved public IP address after the instance is created.
        assignPublicIp: "false",
        displayName: "instanceVnic",
        subnetId: publicSubnetResource.id,
    },
    sourceDetails: {
        sourceType: "image",
        // TODO: Update the sourceId with your OCID image and select your region.
        // Note that Oracle Autonomous Linux not supported in ARM.
        // https://docs.oracle.com/en-us/iaas/images
        // The example image below is "Oracle-Linux-9.4-aarch64-2024.09.30-0" with us-ashburn-1 region.
        sourceId: "ocid1.image.oc1.iad.aaaaaaaavwzcqynwfsnckoyct4fsolbzxpci3xzek35scbmbe6ga46kyv6sa"
    },

    shapeConfig: {
        ocpus: 4,
        memoryInGbs: 24.0,
    },
    displayName: "instance",
})



// Once the instance is created, we can get the VNIC attachment and VNIC
const instanceVnicAttachments = oci.core.getVnicAttachmentsOutput({
    compartmentId: exampleCompartment.id,
    instanceId: instanceResource.id,
});


const instanceVnic = oci.core.getVnicOutput({
    vnicId: instanceVnicAttachments.vnicAttachments[0].vnicId,
});


// Filter on private IP address and Subnet OCID
const examplePrivateIpsByIpAddress = oci.core.getPrivateIpsOutput({
    vnicId: instanceVnic.id,
});

// Create a reserved public IP and attach it to the private IP of the instance
const examplePublicIpResource = new oci.core.PublicIp("example_public_ip", {
    compartmentId: exampleCompartment.id,
    lifetime: "RESERVED",
    displayName: "computePublicIp",
    privateIpId: examplePrivateIpsByIpAddress.privateIps[0].id,
});


export const instancePublicIp = instanceResource.publicIp
export const createShape = instanceResource.shape
export const createVnic = instanceResource.createVnicDetails
