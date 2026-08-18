const { supabaseAdmin } = require("./supabase");

async function getUserMemories(userId, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("memories")
    .select("id, memory, category, importance, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Memory retrieval error:", error);
    return [];
  }

  return data || [];
}

async function saveMemory({
  userId,
  memory,
  category = "general",
  importance = 5
}) {
  if (!memory || !memory.trim()) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("memories")
    .insert({
      user_id: userId,
      memory: memory.trim(),
      category,
      importance
    })
    .select()
    .single();

  if (error) {
    console.error("Memory save error:", error);
    return null;
  }

  return data;
}

async function deleteMemory(userId, memoryId) {
  const { error } = await supabaseAdmin
    .from("memories")
    .delete()
    .eq("id", memoryId)
    .eq("user_id", userId);

  return !error;
}

module.exports = {
  getUserMemories,
  saveMemory,
  deleteMemory
};
