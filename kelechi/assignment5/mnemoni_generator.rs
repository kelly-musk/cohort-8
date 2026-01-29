use bip39::{Mnemonic};
use rand::Rng;

pub fn generate_seed_phrase() -> String {
    // Generate random entropy (i6 bytes for 12words )
    let mut rng = rand::rng();
    let mut entropy = [0u8; 16];

    rng.fill(&mut entropy);

    // create a seed phrase from the generatd entropy
    let mnemonic =
        Mnemonic::from_entropy(&entropy).expect("failed to create mnemonic from entropy");

    // return the seed phrase as a string
    mnemonic.to_string()
}

/// generate aseed phrase with a specific wordcount
/// word count range from 12, 15, 18, 21 or 24
pub fn generate_seed_with_word_count(word_count: usize) -> String {
    let entropy_size = match word_count {
        12 => 16, // 128 bits
        15 => 20, // 160 bits
        18 => 24, // 192 bits
        21 => 28, // 224 bits
        24 => 32, // 256 bits
        _ => {
            eprintln!(
                "invalid wordcount try using this numbers word count range from 12, 15, 18, 21 or 24"
            );
            16
        }
    };

    // generate random entropy from entropy size
    let mut rng = rand::rng();
    let mut entropy = vec![0u8; entropy_size];

    rng.fill(&mut entropy[..]);

    let mnemonic = Mnemonic::from_entropy(&entropy).expect("failed to create mnemonic from entrpy");
    mnemonic.to_string()
}

pub fn generate_seed_and_seedphrase_by_wordcount(
    word_count: usize,
    passphrase: Option<&str>,
) -> (String, Vec<u8>) {
    let entropy_size = match word_count {
        12 => 16, // 128 bits
        15 => 20, // 160 bits
        18 => 24, // 192 bits
        21 => 28, // 224 bits
        24 => 32, // 256 bits
        _ => {
            eprintln!(
                "invalid wordcount try using this numbers word count range from 12, 15, 18, 21 or 24"
            );
            16
        }
    };

    let mut rng = rand::rng();
    let mut entropy = vec![0u8; entropy_size];

    rng.fill(&mut entropy[..]);

    let mnemonic = Mnemonic::from_entropy(&entropy).expect("failed to generate seed");

    let phrsae = mnemonic.to_string();

    let mnemonic2= Mnemonic::parse(&phrsae).expect("failed to parse mnemonic");

    let seed = mnemonic2.to_seed(passphrase.unwrap_or(""));

    (phrsae, seed.to_vec())
}
