export const prerender = false;
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

const POLL_ID = 'weekly-audience-poll';

const VALID_OPTIONS = new Set([
	'opt1',
	'opt2',
	'opt3',
	'opt4',
	'opt5'
]);

const emptyVotes = () => ({
	opt1: 0,
	opt2: 0,
	opt3: 0,
	opt4: 0,
	opt5: 0
});

export const GET: APIRoute = async () => {
	try {
		const { data, error } = await supabase
			.from('poll_votes')
			.select('option_id')
			.eq('poll_id', POLL_ID);

		if (error) {
			console.error(
				'Supabase poll results error:',
				error
			);

			return new Response(
				JSON.stringify({
					success: false,
					error: error.message
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		const votes = emptyVotes();

		for (const row of data ?? []) {
			if (VALID_OPTIONS.has(row.option_id)) {
				votes[row.option_id as keyof typeof votes]++;
			}
		}

		const total = Object.values(votes).reduce(
			(sum, count) => sum + count,
			0
		);

		return new Response(
			JSON.stringify({
				success: true,
				votes,
				total
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store'
				}
			}
		);
	} catch (error) {
		console.error('Poll GET error:', error);

		return new Response(
			JSON.stringify({
				success: false,
				error:
					error instanceof Error
						? error.message
						: String(error)
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		/*
		 * Read the request body safely.
		 */
		const rawBody = await request.text();

		console.log('Poll POST body:', rawBody);

		if (!rawBody) {
			return new Response(
				JSON.stringify({
					success: false,
					error: 'Request body is empty.'
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		let body: {
			optionId?: unknown;
			voterId?: unknown;
		};

		try {
			body = JSON.parse(rawBody);
		} catch (parseError) {
			console.error(
				'Poll JSON parse error:',
				parseError
			);

			return new Response(
				JSON.stringify({
					success: false,
					error: 'Request body is not valid JSON.'
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		const optionId = body.optionId;
		const voterId = body.voterId;

		console.log('Poll optionId:', optionId);
		console.log('Poll voterId:', voterId);

		/*
		 * Validate option.
		 */
		if (
			typeof optionId !== 'string' ||
			!VALID_OPTIONS.has(optionId)
		) {
			return new Response(
				JSON.stringify({
					success: false,
					error: `Invalid poll option: ${String(optionId)}`
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		/*
		 * Validate voter ID.
		 */
		if (
			typeof voterId !== 'string' ||
			voterId.length < 10 ||
			voterId.length > 100
		) {
			return new Response(
				JSON.stringify({
					success: false,
					error: 'Invalid voter ID.'
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		/*
		 * Insert the vote into Supabase.
		 */
		const { data, error } = await supabase
			.from('poll_votes')
			.insert({
				poll_id: POLL_ID,
				option_id: optionId,
				voter_id: voterId
			})
			.select()
			.single();

		if (error) {
			console.error(
				'Supabase vote insert error:',
				error
			);

			/*
			 * Duplicate voter.
			 */
			if (error.code === '23505') {
				return new Response(
					JSON.stringify({
						success: false,
						alreadyVoted: true,
						error: 'You have already voted.'
					}),
					{
						status: 409,
						headers: {
							'Content-Type': 'application/json'
						}
					}
				);
			}

			return new Response(
				JSON.stringify({
					success: false,
					error: error.message,
					code: error.code,
					details: error.details
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		console.log('Vote successfully inserted:', data);

		return new Response(
			JSON.stringify({
				success: true,
				vote: data
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	} catch (error) {
		console.error('Poll POST error:', error);

		return new Response(
			JSON.stringify({
				success: false,
				error:
					error instanceof Error
						? error.message
						: String(error)
			}),
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};