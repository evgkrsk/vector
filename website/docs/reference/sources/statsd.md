---
delivery_guarantee: "best_effort"
description: "The Vector `statsd` source ingests data through the StatsD UDP protocol and outputs `metric` events."
event_types: ["metric"]
issues_url: https://github.com/timberio/vector/issues?q=is%3Aopen+is%3Aissue+label%3A%22source%3A+statsd%22
operating_systems: ["linux","macos","windows"]
sidebar_label: "statsd|[\"metric\"]"
source_url: https://github.com/timberio/vector/tree/master/src/sources/statsd/mod.rs
status: "beta"
title: "Statsd Source"
unsupported_operating_systems: []
---

The Vector `statsd` source ingests data through the StatsD UDP protocol and outputs [`metric`][docs.data-model.metric] events.

<!--
     THIS FILE IS AUTOGENERATED!

     To make changes please edit the template located at:

     website/docs/reference/sources/statsd.md.erb
-->

## Configuration

import CodeHeader from '@site/src/components/CodeHeader';

<CodeHeader fileName="vector.toml" learnMoreUrl="/docs/setup/configuration/"/ >

```toml
[sources.my_source_id]
  type = "statsd" # must be: "statsd"
  address = "127.0.0.1:8126" # example
```

## Options

import Fields from '@site/src/components/Fields';

import Field from '@site/src/components/Field';

<Fields filters={true}>


<Field
  common={true}
  defaultValue={null}
  enumValues={null}
  examples={["127.0.0.1:8126"]}
  name={"address"}
  nullable={false}
  path={null}
  relevantWhen={null}
  required={true}
  templateable={false}
  type={"string"}
  unit={null}
  >

### address

UDP socket address to bind to.


</Field>


</Fields>

## Output

The `statsd` source ingests data through the StatsD UDP protocol and outputs [`metric`][docs.data-model.metric] events.
For example:


import Tabs from '@theme/Tabs';

<Tabs
  block={true}
  defaultValue="counter"
  values={[{"label":"Counter","value":"counter"},{"label":"Gauge","value":"gauge"},{"label":"Set","value":"set"},{"label":"Timer","value":"timer"}]}>

import TabItem from '@theme/TabItem';

<TabItem value="counter">

Given the following input:

```text
login.invocations:1|c
```

A metric event will be output with the following structure:

```json
{
  "name": "login.invocations",
  "kind": "incremental",
  "timestamp": "2019-05-02T12:22:46.658503Z" // current time / time ingested
  "value": {
    "type": "counter",
    "value": 1.0
  }
}
```

</TabItem>

<TabItem value="gauge">

Given the following input:

```text
gas_tank:0.50|g
```

A metric event will be output with the following structure:

```json
{
  "name": "gas_tank",
  "kind": "absolute",
  "timestamp": "2019-05-02T12:22:46.658503Z" // current time / time ingested
  "value": {
    "type": "gauge",
    "value": 0.5
  }
}
```

</TabItem>

<TabItem value="set">

Given the following input:

```text
unique_users:foo|s
```

A metric event will be output with the following structure:

```json
{
  "name": "unique_users",
  "kind": "incremental",
  "timestamp": "2019-05-02T12:22:46.658503Z" // current time / time ingested
  "value": {
    "type": "set",
    "values": ["foo"]
  }
}
```

</TabItem>

<TabItem value="timer">

Given the following input:

```text
login.time:22|ms|@0.1
```

A metric event will be output with the following structure:

```json
{
  "name": "login.time",
  "kind": "incremental",
  "timestamp": "2019-05-02T12:22:46.658503Z" // current time / time ingested
  "value": {
    "type": "distribution",
    "values": [0.022], // ms become seconds
    "sample_rates": [10]
  }
}
```

</TabItem>
</Tabs>

## How It Works

### Environment Variables

Environment variables are supported through all of Vector's configuration.
Simply add `${MY_ENV_VAR}` in your Vector configuration file and the variable
will be replaced before being evaluated.

You can learn more in the [Environment Variables][docs.configuration#environment-variables]
section.

### Timestamp

StatsD protocol does not provide support for sending metric timestamps. You'll
notice that each parsed metric is assigned a `null` timestamp, which is a
special value which means "a real time metric" (not historical one). Normally such
`null` timestamps will be substituted by current time by downstream sinks or
3rd party services during sending/ingestion. See the [metric][docs.data-model.metric]
data model page for more info.


[docs.configuration#environment-variables]: /docs/setup/configuration/#environment-variables
[docs.data-model.metric]: /docs/about/data-model/metric/
