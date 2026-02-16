I have completed the task.

1.  I read `src/core/session.rs` and confirmed that the `save` method uses `tokio::fs::write`, which is a standard async file I/O operation and is safe.
2.  I modified `src/core/downloader.rs` to insert `drop(rx);` before the worker join loop. This ensures that any workers blocked on sending to the channel will error out and exit, allowing the `join` to complete and preventing deadlocks.
3.  I verified the changes by running `cargo check`, which passed successfully.