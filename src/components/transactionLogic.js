import { doc, updateDoc, collection, addDoc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Function to handle generating journal entries based on agents involved - CLIENT
export const handleTransactionResult = async (transactionId, selectedResult) => {
  const transactionRef = doc(db, 'transactions', transactionId);

  // Fetch the actual transaction document
  const transactionDoc = await getDoc(transactionRef);

  if (!transactionDoc.exists()) {
    console.error("Transaction document not found");
    return;
  }

  const transactionData = transactionDoc.data(); // Extract the transaction document data

  // Shared logic for all result types - Update the transaction
  await updateDoc(transactionRef, {
    status: 'Closed-Settled',
    result: selectedResult,
  });

  // Handle the "void" case
  if (selectedResult === 'void') {
    // Nothing additional needs to be done apart from the transaction update
    console.log('Transaction has been voided.');
    return;
  }

  // Fetch client data for both "lose" and "win" cases
  const messagesClientQuery = query(
    collection(db, 'messages_client'),
    where('transactionId', '==', transactionId),
    where('type', '==', 'client_fill')
  );
  const messagesClientSnapshot = await getDocs(messagesClientQuery);

  let clientAmount = 0;
  let clientPrice = 0;
  if (!messagesClientSnapshot.empty) {
    const clientData = messagesClientSnapshot.docs[0].data();
    clientAmount = Number(clientData.client_amount); // Convert clientAmount to a number
    clientPrice = Number(clientData.client_price); // Convert clientAmount to a number
    
  } else {
    console.log("No matching client data found in messages_client.");
  }

  const nomname = transactionData.requestby || 'Unknown Requestor';
  const date = transactionData.datetime || new Date(); // Default to current date
  const ref = transactionData.event || 'Unknown Event';
  const details = transactionData.bet || 'Unknown Bet';
  const notes = selectedResult;

  // Sub-collection reference for "Journals"
  const journalsSubCollectionRef = collection(transactionRef, 'Journals');

  // Common journal entries for both "lose" and "win"
  await addDoc(journalsSubCollectionRef, {
    jrnl_no: 1,
    acc_type: 'B/S',
    nomcode: 1000,
    nomname: "Client Control Acc - " + nomname,
    date: date,
    ref: ref,
    details: details,
    DR: Number(clientAmount),
    CR: 0,
    Notes: notes,
    systype: 'fromResult',
  });

  await addDoc(journalsSubCollectionRef, {
    jrnl_no: 1,
    acc_type: 'P&L',
    nomcode: 4000,
    nomname: "Client Stakes - " + nomname,
    date: date,
    ref: ref,
    details: details,
    DR: 0,
    CR: Number(clientAmount),
    Notes: notes,
    systype: 'fromResult',
  });

  // Handle the "win" case for additional logic
  if (selectedResult === 'win') {
    console.log('Handling win case...');

    await addDoc(journalsSubCollectionRef, {
      jrnl_no: 1,
      acc_type: 'B/S',
      nomcode: 1000,
      nomname: "Client Control Acc - " + nomname,
      date: date,
      ref: ref,
      details: details,
      DR: 0,
      CR: Number(clientAmount) * Number(clientPrice),
      Notes: notes,
      systype: 'fromResult',
    });
  
    await addDoc(journalsSubCollectionRef, {
      jrnl_no: 1,
      acc_type: 'P&L',
      nomcode: 6000,
      nomname: "Client Winnings - " + nomname,
      date: date,
      ref: ref,
      details: details,
      DR: Number(clientAmount) * Number(clientPrice),
      CR: 0,
      Notes: notes,
      systype: 'fromResult',
    });

    console.log('Winnings journal entries added.');
  }
};


// Function to handle generating journal entries based on agents involved - SUPPILER
export const generateAgentJournals = async (transactionId, selectedResult) => {
  try {
    // Step 1: Fetch the actual transaction document from the 'transactions' collection
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      console.error("Transaction document not found");
      return;
    }

    const transactionData = transactionDoc.data(); // Extract the transaction document data

    // Shared logic for updating the transaction
    await updateDoc(transactionRef, {
      status: 'Closed-Settled',
      result: selectedResult,
    });

      // Handle the "void" case
    if (selectedResult === 'void') {
      // Nothing additional needs to be done apart from the transaction update
      console.log('Transaction has been voided.');
      return;
    }

    // Step 2: Query messages_agents for the given transactionId and type 'agent_fill'
    const messagesAgentsRef = collection(db, 'messages_agents');
    const q = query(
      messagesAgentsRef,
      where('transactionId', '==', transactionId),
      where('type', '==', 'agent_fill')
    );

    // Fetch all matching documents
    const querySnapshot = await getDocs(q);

    // Step 3: Extract distinct agentId values and their associated amounts
    const agentAmounts = {}; // Will store agentId and their respective amount & price
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!agentAmounts[data.agentId]) {
        const amount = parseFloat(data.amount); // Initialize with the agent amount, converted to a number
        const price = parseFloat(data.price || 0); // Default price to 0 if not available
        const winnings = amount * price; // Calculate winnings for "win" case
        agentAmounts[data.agentId] = { amount, price, winnings }; // Store amount, price, and winnings
      }
    });

    // Step 4: Ensure necessary fields are defined from transactionData
    const date = transactionData.datetime || new Date(); // Default to current date if not defined
    const ref = transactionData.event || 'Unknown Event';
    const details = transactionData.bet || 'Unknown Bet';
    const notes = selectedResult;

    // Step 5: Sub-collection reference for "Journals" in the current transaction
    const journalsSubCollectionRef = collection(transactionRef, 'Journals'); // Reference to the Journals sub-collection

    // Step 6: Generate journal entries per distinct agentId
    let jrnlNo = 2; // Initialize the journal number, adjust as needed based on your logic

    // Common journal entries for both "lose" and "win"
    for (const [agentId, agentData] of Object.entries(agentAmounts)) {
      const assignedAgent = transactionData.AssignedAgents.find((agent) => agent === agentId);
      const agentName = assignedAgent ? assignedAgent : 'Unknown Agent';

      const { amount } = agentData; // Extract amount for this agent

      // First journal entry (B/S)
      await addDoc(journalsSubCollectionRef, {
        jrnl_no: jrnlNo,
        acc_type: 'B/S',
        nomcode: 2000,
        nomname: "Supplier Control Acc - " + agentName, // Concatenate string with agentName
        date: date,
        ref: ref,
        details: details,
        DR: 0, // No debit for "lose"
        CR: Number(amount), // Credit the amount for the agent
        Notes: notes,
        systype: 'fromResult',
      });

      // Second journal entry (P&L)
      await addDoc(journalsSubCollectionRef, {
        jrnl_no: jrnlNo,
        acc_type: 'P&L',
        nomcode: 5000,
        nomname: "Bookie Stakes - " + agentName, // Concatenate string with agentName,
        date: date,
        ref: ref,
        details: details,
        DR: Number(amount), // Debit the amount for this agent
        CR: 0, // No credit
        Notes: notes,
        systype: 'fromResult',
      });

      // Increment journal number for the next agent
      jrnlNo += 1;
    }
    
    // Handle the "win" case
    if (selectedResult === 'win') {
      for (const [agentId, agentData] of Object.entries(agentAmounts)) {
        const assignedAgent = transactionData.AssignedAgents.find((agent) => agent === agentId);
        const agentName = assignedAgent ? assignedAgent : 'Unknown Agent';

        const { amount, price } = agentData; // Extract amount and winnings for this agent

        // First journal entry for winnings (B/S)
        await addDoc(journalsSubCollectionRef, {
          jrnl_no: jrnlNo,
          acc_type: 'B/S',
          nomcode: 2000,
          nomname: "Supplier Control Acc - " + agentName, // Concatenate string with agentName
          date: date,
          ref: ref,
          details: details,
          DR: Number(amount * price), // Debit the winnings to the agent
          CR: 0, // Explicit conversion to a number (winnings)
          Notes: notes,
          systype: 'fromResult',
        });

        // Second journal entry for winnings (P&L)
        await addDoc(journalsSubCollectionRef, {
          jrnl_no: jrnlNo,
          acc_type: 'P&L',
          nomcode: 7000,
          nomname: "Bookie Winnings - " + agentName, // Concatenate string with agentName
          date: date,
          ref: ref,
          details: details,
          DR: 0, // Explicit conversion to a number (winnings)
          CR: Number(amount * price), // No credit for this entry
          Notes: notes,
          systype: 'fromResult',
        });

        // Increment journal number for the next agent
        jrnlNo += 1;
      }
    }

    console.log('Journals successfully generated for all agents.');
    // Return the last journal number for possible further processing
    return jrnlNo;
  } catch (error) {
    console.error('Error generating journals:', error);
  }
};



// Function to handle generating the additional journal entries - DLA (INTERNAL)
export const generateAdditionalJournals = async (transactionId, selectedResult, lastJrnlNo) => {
  try {
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      console.error("Transaction document not found");
      return;
    }

    const transactionData = transactionDoc.data(); // Extract the transaction document data

    if (selectedResult === 'lose') {
      await updateDoc(transactionRef, {
        status: 'Closed-Settled',
        result: selectedResult,
      });

      const messagesAgentsRef = collection(db, 'messages_agents');
      const agentQuery = query(messagesAgentsRef, where('transactionId', '==', transactionId), where('type', '==', 'agent_fill'));

      const agentQuerySnapshot = await getDocs(agentQuery);

      let totalMessageAgentAmount = 0;
      const agentAmounts = {};
      agentQuerySnapshot.forEach((doc) => {
        const data = doc.data();
        const amount = Number(data.amount);
        if (!agentAmounts[data.agentId]) {
          agentAmounts[data.agentId] = amount;
          totalMessageAgentAmount += amount;
        }
      });

      let clientAmount = 0;
      const messagesClientQuery = query(
        collection(db, 'messages_client'),
        where('transactionId', '==', transactionId),
        where('type', '==', 'client_fill')
      );
      const messagesClientSnapshot = await getDocs(messagesClientQuery);

      if (!messagesClientSnapshot.empty) {
        const clientData = messagesClientSnapshot.docs[0].data();
        clientAmount = Number(clientData.client_amount);
      }

      const date = transactionData.datetime || new Date();
      const ref = transactionData.event || 'Unknown Event';
      const details = transactionData.bet || 'Unknown Bet';
      const notes = selectedResult;

      const journalsSubCollectionRef = collection(transactionRef, 'Journals');
      let jrnlNo = lastJrnlNo;
      const remainingAmount = totalMessageAgentAmount - clientAmount;

      await addDoc(journalsSubCollectionRef, {
        jrnl_no: jrnlNo,
        acc_type: 'B/S',
        nomcode: 2001,
        nomname: "Follow Control Acc - DLA",
        date: date,
        ref: ref,
        details: details,
        DR: remainingAmount,
        CR: 0,
        Notes: notes,
        systype: 'fromResult',
      });

      await addDoc(journalsSubCollectionRef, {
        jrnl_no: jrnlNo,
        acc_type: 'P&L',
        nomcode: 4001,
        nomname: "Follow Stakes - internal",
        date: date,
        ref: ref,
        details: details,
        DR: 0,
        CR: remainingAmount,
        Notes: notes,
        systype: 'fromResult',
      });

      console.log('Additional journals successfully generated and transaction updated.');
    }
  } catch (error) {
    console.error('Error generating additional journals:', error);
  }
};
