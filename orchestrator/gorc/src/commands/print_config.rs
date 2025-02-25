use crate::application::APP;
use crate::config::GorcConfig;
use abscissa_core::{clap::Parser, Application, Command, Runnable};

/// Command for printing configurations
#[derive(Command, Debug, Default, Parser)]
pub struct PrintConfigCmd {
    #[clap(short, long)]
    show_default: bool,
}

impl Runnable for PrintConfigCmd {
    fn run(&self) {
        let config = if self.show_default {
            GorcConfig::default()
        } else {
            let config = APP.config();
            GorcConfig {
                keystore: config.keystore.to_owned(),
                gravity: config.gravity.to_owned(),
                ethereum: config.ethereum.to_owned(),
                cosmos: config.cosmos.to_owned(),
                metrics: config.metrics.to_owned(),
                relayer: config.relayer.to_owned(),
            }
        };

        print!("{}", toml::to_string(&config).unwrap());
    }
}
