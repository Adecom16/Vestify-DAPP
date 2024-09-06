"use client";

import { useCallback, useRef, useContext, useState } from "react";
import { Contract, providers } from "ethers";
import Web3Modal from "web3modal";
import Link from "next/link";
import { useRouter } from "next/router";
import { ethers } from "ethers";

import { DAppContext } from "@/context";

import {
  VESTING_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ADDRESS,
  VESTING_ABI,
  TOKEN_ABI,
} from "@/contract";

export default function Home() {
  const CHAIN_ID = 11155111;
  const NETWORK_NAME = "Sepolia";

  const [provider, setProvider] = useState(null);

  // const web3ModalRef = useRef("");

  const web3ModalRef = useRef(() => new Web3Modal());

  const {
    walletConnected,
    setWalletConnected,
    account,
    setAccount,
    vested,
    setVested,
  } = useContext(DAppContext);

  const getProvider = useCallback(async () => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);
    const getSigner = web3Provider.getSigner();

    const { chainId } = await web3Provider.getNetwork();

    setAccount(await getSigner.getAddress());
    setWalletConnected(true);

    if (chainId !== CHAIN_ID) {
      alert(`Please switch to the ${NETWORK_NAME} network!`);
      throw new Error(`Please switch to the ${NETWORK_NAME} network`);
    }
    setProvider(web3Provider);
  }, []);

  // Helper function to fetch a Signer instance from MetaMask
  const getSigner = useCallback(async () => {
    try {
      if (typeof window.ethereum === "undefined") {
        alert("pls install metamask to use this feature");
        return;
      }
      // Initialize Web3Provider with window.ethereum
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      // Request access to the user's MetaMask accounts
      await provider.send("eth_requestAccounts", []);

      // Get the chain ID from the connected network
      const { chainId } = await provider.getNetwork();

      // Check if the chain ID matches your desired network
      if (chainId !== CHAIN_ID) {
        alert(`Please switch to the ${NETWORK_NAME} network!`);
        throw new Error(`Please switch to the ${NETWORK_NAME} network`);
      }

      // Get the signer instance
      const signer = await provider.getSigner();

      // Log the signer's address
      const address = await signer.getAddress();
      console.log("Signer address:", address);

      return signer;
    } catch (error) {
      console.error("Error fetching signer:", error);
      // Handle errors appropriately
      throw error;
    }
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      web3ModalRef.current = new Web3Modal({
        network: NETWORK_NAME,
        providerOptions: {},
        disableInjectedProvider: false,
      });

      await getProvider();
    } catch (error) {
      console.error(error);
    }
  }, [getProvider]);

  const disconnectWallet = useCallback(() => {
    setWalletConnected(false);
    setAccount("");

    web3ModalRef.current = null;
  }, [setWalletConnected, setAccount]);

  // Helper function to return a Todo Contract instance
  // given a Provider/Signer

  const getVestingContractInstance = useCallback((providerOrSigner) => {
    try {
      return new Contract(
        VESTING_CONTRACT_ADDRESS,
        VESTING_ABI,
        providerOrSigner
      );
    } catch (error) {
      console.error("Error creating vesting contract instance:", error);
    }
  }, []);

  const getTokenContractInstance = useCallback((providerOrSigner) => {
    try {
      return new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, providerOrSigner);
    } catch (error) {
      console.error("Error creating token contract instance:", error);
      return null;
    }
  }, []);

  const approveToken = async (e) => {
    try {
      const signer = await getSigner();
      console.log("signer", signer);
      const tokenContract = getTokenContractInstance(signer);
      console.log("tokenContract", tokenContract);

      const approve = await tokenContract.approve(
        VESTING_CONTRACT_ADDRESS,
        formEntries.amount
      );
      console.log("approve", approve);
      return approve; // Return the result if needed
    } catch (error) {
      console.error("Error approving tokens:", error);
      throw error; // Re-throw the error to propagate it to the caller
    }
  };

  const mintToken = async (e) => {
    e.preventDefault();
    try {
      setMinting(true);
      const signer = await getSigner();
      console.log("signer", signer);
      const tokenContract = getTokenContractInstance(signer);
      console.log("tokenContract", tokenContract);

      const Mint = await tokenContract.mint(
        mintEntries.accountMinter,
        mintEntries.amountMinter
      );
      console.log("Mint", Mint);
      alert("Minted successfully");
      setMinting(false);
      resetMintEntries();
    } catch (error) {
      setMinting(false);
      alert("Error Minting", error);
      throw error; // Re-throw the error to propagate it to the caller
    }
  };

  const createVestingSchedule = async (e) => {
    e.preventDefault();
    const epochTime = dateToEpoch(formEntries.vestingDuration);
    console.log("Epoch Time:", epochTime);

    if (
      !formEntries.organisationName ||
      !formEntries.description ||
      !formEntries.selectedButtonValue ||
      !epochTime ||
      !formEntries.beneficiary ||
      !formEntries.amount
    ) {
      alert("Please fill all fields");
      return;
    } else {
      try {
        await approveToken();

        const signer = await getSigner();
        console.log("signer", signer);
        setLoading(true);
        const vestingContract = getVestingContractInstance(signer);
        console.log("vesting Instance", vestingContract);

        const tx = await vestingContract.createVestingSchedule(
          formEntries.amount,
          formEntries.beneficiary,
          formEntries.selectedButtonValue,
          epochTime,
          formEntries.organisationName,
          formEntries.description
        );

        await tx.wait();
        console.log("created vesting", tx);

        setLoading(false);
        setWhitelist(true);
        alert("Vesting Schedule created successfully");
        resetFormEntries();
      } catch (error) {
        alert("Error creating vesting schedule:", error);
        setLoading(false);
        setWhitelist(false);
        // Handle error appropriately, e.g., display an error message to the user
        // You can also re-throw the error if you want to propagate it further
      }
    }
  };

  const resetButtonStyles = () => {
    // Reset the background color of all buttons
    const buttons = document.querySelectorAll("button");
    buttons.forEach((button) => {
      button.style.backgroundColor = "";
    });
  };

  // Function to convert datetime to epoch
  const dateToEpoch = (dateString) => {
    const myDate = new Date(dateString);
    const epochTime = myDate.getTime() / 1000.0;
    return epochTime;
  };

  const [formEntries, setFormEntries] = useState({
    organisationName: "",
    description: "",
    selectedButtonValue: "",
    vestingDuration: "",
    beneficiary: "",
    amount: "",
  });

  const [mintEntries, setMintEntries] = useState({
    accountMinter: "",
    amountMinter: "",
  });

  const resetFormEntries = () => {
    setFormEntries({
      organisationName: "",
      description: "",
      selectedButtonValue: "",
      vestingDuration: "",
      beneficiary: "",
      amount: "",
    });
    return setWhitelist(true);
  };

  const resetMintEntries = () => {
    setFormEntries({
      accountMinter: "",
      amountMinter: "",
    });
  };

  const formEntriesHandler = (e) => {
    let key = e.currentTarget.name;
    let value = e.currentTarget.value;

    console.log(key, value);

    setFormEntries((formEntrys) => ({
      ...formEntrys,
      [key]: value,
    }));
  };

  const formMintHandler = (e) => {
    let key = e.currentTarget.name;
    let value = e.currentTarget.value;

    console.log(key, value);

    setMintEntries((mintEntries) => ({
      ...mintEntries,
      [key]: value,
    }));
  };

  const [minting, setMinting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [whitelist, setWhitelist] = useState(false);

  // FOR WHITELIST VERSION

  const [pending, setPending] = useState(false);
  const [whitelisted, setWhiteListed] = useState(false);

  const [whiteListFormEntries, setWhiteListFormEntries] = useState({
    whiteList: "",
  });

  const whitelistVestedAddress = async (e) => {
    e.preventDefault();

    if (!whiteListFormEntries.whiteList) {
      alert("Please fill field");
      return;
    } else {
      try {
        const signer = await getSigner();
        console.log("signer", signer);
        setPending(true);
        const vestingContract = getVestingContractInstance(signer);
        console.log("whiteListing Instance", vestingContract);

        const tx = await vestingContract.whitelistAddress(
          whiteListFormEntries.whiteList
        );

        await tx.wait();
        console.log("created whiteList", tx);

        setPending(false);

        alert("Address whitelisted successfully");
        resetWhiteListFormEntries();
      } catch (error) {
        let errorMessage;
        if (error.message.includes("Address is already whitelisted ")) {
          errorMessage = "Address is already whitelisted ";
        } else {
          errorMessage = "Error whitelisting, refresh: " + error.message;
        }
        alert(errorMessage);
        setPending(false);
      }
    }
  };

  const formWhiteListEntriesHandler = (e) => {
    let key = e.currentTarget.name;
    let value = e.currentTarget.value;

    setWhiteListFormEntries((formEntrys) => ({
      ...formEntrys,
      [key]: value,
    }));
  };

  const resetWhiteListFormEntries = () => {
    setWhiteListFormEntries({
      whiteList: "",
    });
    return setWhiteListed(true);
  };

  return (
    <main className="bg-gray-900 min-h-screen">
      <div className="container mx-auto px-6">
        <nav className="flex justify-between items-center py-6">
          <h1 className="text-white text-2xl font-extrabold">Vestify</h1>
          <div>
            {!walletConnected ? (
              <button
                onClick={connectWallet}
                className="bg-purple-600 text-white rounded-lg px-5 py-3 transition-transform transform hover:scale-105"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/claim">
                  <span className="text-white text-lg font-semibold hover:text-purple-300 cursor-pointer">
                    Claim Tokens
                  </span>
                </Link>
                <button
                  onClick={disconnectWallet}
                  className="bg-purple-600 text-white rounded-lg px-5 py-3 transition-transform transform hover:scale-105"
                >
                  Disconnect Wallet
                </button>
              </div>
            )}
          </div>
        </nav>

        <section className="text-center py-12">
          {!walletConnected ? (
            <>
              <h3 className="text-white text-4xl font-bold mb-6 mt-20">
                Welcome to <span className="text-purple-400">Vestify</span>, the
                decentralized vesting platform
              </h3>
              <p className="text-gray-300 text-lg mb-8">
                To interact with this Dapp, you need to have{" "}
                <span className="text-purple-400">Sepolia ETH</span> for gas
                fees and be airdropped some{" "}
                <span className="text-purple-300">VTokens</span>. Mint some
                tokens now!
              </p>
              {/* <p className="text-gray-400 text-sm mb-8">
                TOKEN CA: <br /> 0x4469199279E1910c508CF9FD0d1D873755831131
              </p> */}

              <form
                onSubmit={mintToken}
                className="max-w-lg mx-auto bg-gray-800 p-8 rounded-lg shadow-lg"
              >
                <div className="mb-6">
                  <label className="block text-white text-sm font-semibold mb-2">
                    Address to be Airdropped
                  </label>
                  <input
                    required
                    name="accountMinter"
                    value={mintEntries.accountMinter}
                    onChange={formMintHandler}
                    className="border rounded-lg w-full py-3 px-4 text-gray-900"
                    placeholder="Input your ETH address"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-white text-sm font-semibold mb-2">
                    Amount
                  </label>
                  <input
                    required
                    name="amountMinter"
                    value={mintEntries.amountMinter}
                    onChange={formMintHandler}
                    className="border rounded-lg w-full py-3 px-4 text-gray-900"
                    placeholder="Any number, 0-300"
                  />
                </div>

                <button
                  disabled={minting}
                  type="submit"
                  className={`py-3 px-5 rounded-lg w-full ${
                    minting
                      ? "bg-gray-600"
                      : "bg-purple-600 hover:bg-purple-500"
                  } text-white font-bold`}
                >
                  {minting ? "Minting..." : "Mint"}
                </button>
              </form>
            </>
          ) : (
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-3xl mx-auto">
              {!whitelist ? (
                <form onSubmit={createVestingSchedule}>
                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-2">
                      Name of Organisation
                    </label>
                    <input
                      required
                      name="organisationName"
                      value={formEntries.organisationName}
                      onChange={formEntriesHandler}
                      className="border rounded-lg w-full py-3 px-4 text-gray-900"
                      placeholder="Name of organisation"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-2">
                      Description
                    </label>
                    <textarea
                      required
                      name="description"
                      value={formEntries.description}
                      onChange={formEntriesHandler}
                      className="border rounded-lg w-full py-3 px-4 text-gray-900"
                      placeholder="A short description of the organisation"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-2">
                      Stakeholder Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "None",
                        "Founder",
                        "Investor",
                        "Community",
                        "PreSale",
                      ].map((type, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() =>
                            setFormEntries({
                              ...formEntries,
                              selectedButtonValue: index.toString(),
                            })
                          }
                          className={`px-4 py-2 rounded-lg text-white font-semibold ${
                            formEntries.selectedButtonValue === index.toString()
                              ? "bg-blue-300"
                              : "bg-purple-600"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-2">
                      Vesting Duration
                    </label>
                    <input
                      required
                      name="vestingDuration"
                      type="datetime-local"
                      value={formEntries.vestingDuration}
                      onChange={formEntriesHandler}
                      className="border rounded-lg w-full py-3 px-4 text-gray-900"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-2">
                      Beneficiary Address
                    </label>
                    <input
                      required
                      name="beneficiary"
                      value={formEntries.beneficiary}
                      onChange={formEntriesHandler}
                      className="border rounded-lg w-full py-3 px-4 text-gray-900"
                      placeholder="Address of beneficiary"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-white text-sm font-semibold mb-2">
                      Amount to Vest
                    </label>
                    <input
                      required
                      name="amount"
                      type="number"
                      value={formEntries.amount}
                      onChange={formEntriesHandler}
                      className="border rounded-lg w-full py-3 px-4 text-gray-900"
                      placeholder="Input number of tokens to vest"
                    />
                  </div>

                  <button
                    disabled={
                      !formEntries.description ||
                      !formEntries.organisationName ||
                      !formEntries.selectedButtonValue ||
                      !formEntries.vestingDuration ||
                      !formEntries.beneficiary ||
                      !formEntries.amount ||
                      loading
                    }
                    type="submit"
                    className={`py-3 px-5 rounded-lg w-full ${
                      loading
                        ? "bg-gray-600"
                        : "bg-purple-600 hover:bg-purple-500"
                    } text-white font-bold`}
                  >
                    {loading ? "Vesting..." : "Vest Now"}
                  </button>
                </form>
              ) : (
                <div className="text-center">
                  <h3 className="text-white text-xl font-bold mb-4">
                    Whitelist Your Beneficiary Vested Address
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Only whitelisted addresses can claim tokens
                  </p>

                  {!walletConnected ? (
                    <h3 className="text-white">
                      Please connect your wallet to proceed.
                    </h3>
                  ) : (
                    <form
                      onSubmit={whitelistVestedAddress}
                      className="max-w-lg mx-auto bg-gray-800 p-8 rounded-lg shadow-lg"
                    >
                      <div className="mb-6">
                        <label className="block text-white text-sm font-semibold mb-2">
                          Address to Whitelist
                        </label>
                        <input
                          required
                          name="whiteList"
                          type="text"
                          value={whiteListFormEntries.whiteList}
                          onChange={formWhiteListEntriesHandler}
                          className="border rounded-lg w-full py-3 px-4 text-gray-900"
                          placeholder="Whitelist a vested address"
                        />
                      </div>

                      <button
                        disabled={!whiteListFormEntries.whiteList || pending}
                        type="submit"
                        className={`py-3 px-5 rounded-lg w-full ${
                          pending
                            ? "bg-gray-600"
                            : "bg-purple-600 hover:bg-purple-500"
                        } text-white font-bold`}
                      >
                        {pending ? "Whitelisting..." : "Whitelist"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
