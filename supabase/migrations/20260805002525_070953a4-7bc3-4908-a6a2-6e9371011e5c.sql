CREATE POLICY "Owners upload own payment proofs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners read own payment proofs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Owners delete own payment proofs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);