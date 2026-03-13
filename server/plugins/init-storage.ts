export default defineNitroPlugin(async () => {
  await ensureDatabaseReady()
})
