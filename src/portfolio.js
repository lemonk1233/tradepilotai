import { supabase } from "./supabase";

export async function loadPortfolio(userId) {
  const { data, error } = await supabase
    .from("virtual_portfolios")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      balance: 1000,
      holdings: [],
      transactions: []
    };
  }

  return {
    balance: Number(data.balance),
    holdings: data.holdings,
    transactions: data.transactions
  };
}

export async function savePortfolio(
  userId,
  balance,
  holdings,
  transactions
) {
  const { error } = await supabase
    .from("virtual_portfolios")
    .upsert({
      user_id: userId,
      balance,
      holdings,
      transactions
    }, {
      onConflict: "user_id"
    });

  if (error) throw error;
}