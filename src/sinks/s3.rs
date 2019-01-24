use crate::record::Record;
use crate::sinks::util::size_buffered::Buffer;
use futures::{Async, AsyncSink, Future, Sink};
use rusoto_core::region::Region;
use rusoto_core::RusotoFuture;
use rusoto_s3::{PutObjectError, PutObjectOutput, PutObjectRequest, S3Client, S3};
use serde_derive::{Deserialize, Serialize};

pub struct S3Sink {
    buffer: Buffer,
    in_flight: Option<RusotoFuture<PutObjectOutput, PutObjectError>>,
    config: S3SinkConfig,
}

pub struct S3SinkConfig {
    pub buffer_size: usize,
    pub key_prefix: String,
    pub bucket: String,
    pub client: S3Client,
    pub gzip: bool,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct S3SinkConfig2 {
    pub bucket: String,
    pub key_prefix: String,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub buffer_size: usize,
    pub gzip: bool,
    // TODO: access key and secret token (if the rusoto provider chain stuff isn't good enough)
}

#[typetag::serde(name = "s3")]
impl crate::topology::config::SinkConfig for S3SinkConfig2 {
    fn build(&self) -> Result<(super::RouterSink, super::Healthcheck), String> {
        Ok((new(self.config()?), healthcheck(self.config()?)))
    }
}

impl S3SinkConfig2 {
    fn region(&self) -> Result<Region, String> {
        if self.region.is_some() && self.endpoint.is_some() {
            return Err("Only one of 'region' or 'endpoint' can be specified".to_string());
        } else if let Some(region) = &self.region {
            region.parse::<Region>().map_err(|e| e.to_string())
        } else if let Some(endpoint) = &self.endpoint {
            Ok(Region::Custom {
                name: "custom".to_owned(),
                endpoint: endpoint.clone(),
            })
        } else {
            return Err("Must set 'region' or 'endpoint'".to_string());
        }
    }

    fn config(&self) -> Result<S3SinkConfig, String> {
        let region = self.region()?;

        Ok(S3SinkConfig {
            client: rusoto_s3::S3Client::new(region),
            gzip: self.gzip,
            buffer_size: self.buffer_size,
            key_prefix: self.key_prefix.clone(),
            bucket: self.bucket.clone(),
        })
    }
}

impl S3Sink {
    fn send_request(&mut self) {
        let body = self.buffer.get_and_reset();

        // TODO: make this based on the last record in the file
        let filename = chrono::Local::now().format("%Y-%m-%d-%H-%M-%S-%f");
        let extension = if self.config.gzip { ".log.gz" } else { ".log" };

        let request = PutObjectRequest {
            body: Some(body.into()),
            bucket: self.config.bucket.clone(),
            key: format!("{}{}{}", self.config.key_prefix, filename, extension),
            content_encoding: if self.config.gzip {
                Some("gzip".to_string())
            } else {
                None
            },
            ..Default::default()
        };

        let response = self.config.client.put_object(request);
        assert!(self.in_flight.is_none());
        self.in_flight = Some(response);
    }

    fn buffer_full(&self) -> bool {
        self.buffer.size() >= self.config.buffer_size
    }

    fn full(&self) -> bool {
        self.buffer_full() && self.in_flight.is_some()
    }
}

impl Sink for S3Sink {
    type SinkItem = Record;
    type SinkError = ();

    fn start_send(
        &mut self,
        item: Self::SinkItem,
    ) -> Result<AsyncSink<Self::SinkItem>, Self::SinkError> {
        if self.full() {
            self.poll_complete()?;

            if self.full() {
                return Ok(AsyncSink::NotReady(item));
            }
        }

        self.buffer.push(&item.line.into_bytes());
        self.buffer.push(b"\n");

        if self.buffer_full() {
            self.poll_complete()?;
        }

        Ok(AsyncSink::Ready)
    }

    fn poll_complete(&mut self) -> Result<Async<()>, Self::SinkError> {
        loop {
            if let Some(ref mut in_flight) = self.in_flight {
                match in_flight.poll() {
                    Err(e) => panic!("{:?}", e),
                    Ok(Async::Ready(_)) => self.in_flight = None,
                    Ok(Async::NotReady) => {
                        if self.buffer_full() {
                            return Ok(Async::NotReady);
                        } else {
                            return Ok(Async::Ready(()));
                        }
                    }
                }
            } else if self.buffer_full() {
                self.send_request();
            } else {
                return Ok(Async::Ready(()));
            }
        }
    }

    fn close(&mut self) -> Result<Async<()>, Self::SinkError> {
        loop {
            if let Some(ref mut in_flight) = self.in_flight {
                match in_flight.poll() {
                    Err(e) => panic!("{:?}", e),
                    Ok(Async::Ready(_)) => self.in_flight = None,
                    Ok(Async::NotReady) => {
                        return Ok(Async::NotReady);
                    }
                }
            } else if !self.buffer.is_empty() {
                self.send_request();
            } else {
                return Ok(Async::Ready(()));
            }
        }
    }
}

pub fn new(config: S3SinkConfig) -> super::RouterSink {
    let buffer = Buffer::new(config.gzip);

    let sink = S3Sink {
        buffer,
        in_flight: None,
        config,
    };

    Box::new(sink)
}

pub fn healthcheck(config: S3SinkConfig) -> super::Healthcheck {
    use rusoto_s3::{HeadBucketError, HeadBucketRequest};

    let request = HeadBucketRequest {
        bucket: config.bucket,
    };

    let response = config.client.head_bucket(request);

    let healthcheck = response.map_err(|err| match err {
        HeadBucketError::Unknown(response) => match response.status {
            http::status::StatusCode::FORBIDDEN => "Invalid credentials".to_string(),
            http::status::StatusCode::NOT_FOUND => "Unknown bucket".to_string(),
            status => format!("Unknown error: Status code: {}", status),
        },
        err => err.to_string(),
    });

    Box::new(healthcheck)
}